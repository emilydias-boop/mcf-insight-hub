-- 1. Normalizador de nomes
CREATE OR REPLACE FUNCTION public.oi_norm_nome(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(trim(regexp_replace(
    translate(coalesce(t,''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '\s+',' ','g')))
$$;

-- 2. Log de reconciliação
CREATE TABLE IF NOT EXISTS public.asaas_caucao_recon_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_execucao timestamptz NOT NULL DEFAULT now(),
  cobranca_data date,
  nome text,
  valor numeric,
  resultado text NOT NULL,
  transaction_id uuid,
  deal_id uuid,
  detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.asaas_caucao_recon_log TO authenticated;
GRANT ALL ON public.asaas_caucao_recon_log TO service_role;

ALTER TABLE public.asaas_caucao_recon_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recon log readable by authenticated" ON public.asaas_caucao_recon_log;
CREATE POLICY "recon log readable by authenticated"
  ON public.asaas_caucao_recon_log FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_asaas_recon_log_data ON public.asaas_caucao_recon_log (cobranca_data);

-- 3. Taxa do A006
INSERT INTO public.mcf_pay_commission_rates (role, code, rate, notes)
SELECT 'closer','A006',0.15,'closers seguem 15%'
WHERE NOT EXISTS (
  SELECT 1 FROM public.mcf_pay_commission_rates WHERE role='closer' AND code='A006'
);

-- 4. Reconciliação
CREATE OR REPLACE FUNCTION public.asaas_caucao_recon(p_cobrancas jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_origins uuid[] := ARRAY['e3c04f21-ba2c-4c66-84f8-b4341c826b1c'::uuid,'7431cf4a-dc29-4208-95a6-28a499a06dac'::uuid];
  c jsonb;
  v_raw_nome text;
  v_nome text;
  v_norm text;
  v_data date;
  v_valor numeric;
  v_parc_num int;
  v_parc_tot int;
  v_valor_ef numeric;
  v_is_parcela boolean;
  v_lo date;
  v_hi date;
  v_tx uuid;
  v_deal uuid;
  v_new_tx uuid;
  v_res text;
  v_out jsonb := '[]'::jsonb;
  v_min_data date := null;
  v_max_data date := null;
BEGIN
  FOR c IN SELECT * FROM jsonb_array_elements(coalesce(p_cobrancas,'[]'::jsonb)) LOOP
    v_raw_nome := coalesce(c->>'nome','');
    v_data := (c->>'data')::date;
    v_valor := (c->>'valor')::numeric;

    v_parc_num := nullif((regexp_match(v_raw_nome,'^Parcela\s+(\d+)\s+de\s+(\d+)'))[1],'')::int;
    v_parc_tot := nullif((regexp_match(v_raw_nome,'^Parcela\s+(\d+)\s+de\s+(\d+)'))[2],'')::int;
    v_is_parcela := v_parc_num IS NOT NULL;

    -- nome limpo: remove prefixo de parcela / "Pagamento - A000 - Contrato- " e sufixo "[Asaas ...]"
    v_nome := v_raw_nome;
    v_nome := regexp_replace(v_nome,'^Parcela\s+\d+\s+de\s+\d+\.\s*','');
    v_nome := regexp_replace(v_nome,'^Pagamento\s*-\s*A000\s*-\s*Contrato\s*-\s*','');
    v_nome := regexp_replace(v_nome,'\s*\[Asaas[^\]]*\]\s*$','');
    v_nome := trim(v_nome);
    v_norm := public.oi_norm_nome(v_nome);

    IF v_min_data IS NULL OR v_data < v_min_data THEN v_min_data := v_data; END IF;
    IF v_max_data IS NULL OR v_data > v_max_data THEN v_max_data := v_data; END IF;

    -- parcelas subsequentes não representam nova caução
    IF v_is_parcela AND v_parc_num > 1 THEN
      INSERT INTO public.asaas_caucao_recon_log (cobranca_data, nome, valor, resultado, detalhe)
      VALUES (v_data, v_nome, v_valor, 'ignorada_parcela', format('parcela %s de %s', v_parc_num, v_parc_tot));
      v_out := v_out || jsonb_build_object('nome',v_nome,'data',v_data,'valor',v_valor,'resultado','ignorada_parcela');
      CONTINUE;
    END IF;

    v_valor_ef := CASE WHEN v_is_parcela THEN round(v_valor * coalesce(v_parc_tot,1), 2) ELSE v_valor END;
    v_lo := CASE WHEN v_is_parcela THEN v_data - 10 ELSE v_data - 2 END;
    v_hi := v_data + 2;

    IF length(v_norm) < 5 THEN
      INSERT INTO public.asaas_caucao_recon_log (cobranca_data, nome, valor, resultado, detalhe)
      VALUES (v_data, v_nome, v_valor, 'sem_par_crm', 'nome insuficiente para busca');
      v_out := v_out || jsonb_build_object('nome',v_nome,'data',v_data,'valor',v_valor,'resultado','sem_par_crm');
      CONTINUE;
    END IF;

    -- (a) já existe venda equivalente?
    SELECT t.id INTO v_tx
    FROM public.hubla_transactions t
    LEFT JOIN public.crm_deals d ON d.id = t.linked_deal_id
    LEFT JOIN public.crm_contacts ct ON ct.id = d.contact_id
    WHERE t.source IN ('mcfpay','asaas_recon')
      AND t.product_name ILIKE 'A000%'
      AND (t.sale_date AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_lo AND v_hi
      AND (
        v_is_parcela
        OR abs(coalesce(nullif(t.product_price,0), t.net_value, 0) - v_valor_ef) <= greatest(1, v_valor_ef * 0.05)
      )
      AND (
        similarity(public.oi_norm_nome(t.customer_name), v_norm) >= 0.55
        OR similarity(public.oi_norm_nome(ct.name), v_norm) >= 0.55
        OR similarity(public.oi_norm_nome(t.raw_data->'customer'->>'name'), v_norm) >= 0.55
      )
    ORDER BY greatest(
        coalesce(similarity(public.oi_norm_nome(t.customer_name), v_norm),0),
        coalesce(similarity(public.oi_norm_nome(ct.name), v_norm),0)
      ) DESC,
      t.sale_date DESC
    LIMIT 1;

    IF v_tx IS NOT NULL THEN
      INSERT INTO public.asaas_caucao_recon_log (cobranca_data, nome, valor, resultado, transaction_id, deal_id)
      SELECT v_data, v_nome, v_valor, 'ja_existia', v_tx, t.linked_deal_id FROM public.hubla_transactions t WHERE t.id = v_tx;
      v_out := v_out || jsonb_build_object('nome',v_nome,'data',v_data,'valor',v_valor,'resultado','ja_existia');
      CONTINUE;
    END IF;

    -- (b) achar deal no CRM pelo nome
    SELECT d.id INTO v_deal
    FROM public.crm_deals d
    JOIN public.crm_contacts ct ON ct.id = d.contact_id
    WHERE coalesce(d.is_archived,false) = false
      AND d.merged_into_deal_id IS NULL
      AND similarity(public.oi_norm_nome(ct.name), v_norm) >= 0.6
    ORDER BY
      (d.origin_id = ANY(v_origins)) DESC,
      (EXISTS (SELECT 1 FROM public.meeting_slot_attendees a
                JOIN public.meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type = 'r1'
               WHERE a.deal_id = d.id AND coalesce(a.status,'') NOT IN ('cancelled','canceled'))) DESC,
      similarity(public.oi_norm_nome(ct.name), v_norm) DESC,
      d.created_at DESC
    LIMIT 1;

    IF v_deal IS NULL THEN
      INSERT INTO public.asaas_caucao_recon_log (cobranca_data, nome, valor, resultado, detalhe)
      VALUES (v_data, v_nome, v_valor, 'sem_par_crm', 'contato nao encontrado no CRM');
      v_out := v_out || jsonb_build_object('nome',v_nome,'data',v_data,'valor',v_valor,'resultado','sem_par_crm');
      CONTINUE;
    END IF;

    INSERT INTO public.hubla_transactions (
      hubla_id, event_type, product_name, product_code, product_price, net_value,
      customer_name, customer_email, customer_phone, sale_status, payment_method,
      sale_date, source, linked_deal_id, linked_method, linked_at, raw_data
    )
    SELECT
      'asaas_recon_' || md5(v_norm || v_data::text || v_valor::text),
      'asaas_caucao_recon', 'A000 - Contrato', 'A000', v_valor_ef, v_valor_ef,
      v_nome, ct.email, ct.phone, 'pago', 'asaas',
      (v_data::text || ' 12:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo',
      'asaas_recon', v_deal, 'asaas_caucao_recon', now(),
      jsonb_build_object('origem','caucoes-asaas','nome_original',v_raw_nome,'fatura',c->>'fatura','valor_cobranca',v_valor,'parcela',jsonb_build_object('num',v_parc_num,'total',v_parc_tot))
    FROM public.crm_contacts ct
    JOIN public.crm_deals d ON d.contact_id = ct.id AND d.id = v_deal
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_new_tx;

    v_res := CASE WHEN v_new_tx IS NULL THEN 'ja_existia' ELSE 'criada' END;
    INSERT INTO public.asaas_caucao_recon_log (cobranca_data, nome, valor, resultado, transaction_id, deal_id)
    VALUES (v_data, v_nome, v_valor, v_res, v_new_tx, v_deal);
    v_out := v_out || jsonb_build_object('nome',v_nome,'data',v_data,'valor',v_valor,'resultado',v_res,'deal_id',v_deal);
    v_deal := null; v_new_tx := null; v_tx := null;
  END LOOP;

  -- (c) self-heal: remove asaas_recon quando a venda oficial chegou pelo webhook
  IF v_min_data IS NOT NULL THEN
    FOR c IN
      SELECT to_jsonb(r) FROM (
        SELECT t.id, t.customer_name, t.sale_date, coalesce(nullif(t.product_price,0), t.net_value) AS valor, t.linked_deal_id
        FROM public.hubla_transactions t
        WHERE t.source = 'asaas_recon'
          AND (t.sale_date AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_min_data - 10 AND v_max_data + 10
      ) r
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.hubla_transactions m
        WHERE m.source = 'mcfpay'
          AND m.product_name ILIKE 'A000%'
          AND abs(extract(epoch FROM (m.sale_date - (c->>'sale_date')::timestamptz)) / 86400) <= 2
          AND (
            (c->>'linked_deal_id') IS NOT NULL AND m.linked_deal_id::text = (c->>'linked_deal_id')
            OR similarity(public.oi_norm_nome(m.customer_name), public.oi_norm_nome(c->>'customer_name')) >= 0.6
          )
      ) THEN
        DELETE FROM public.hubla_transactions WHERE id = (c->>'id')::uuid;
        INSERT INTO public.asaas_caucao_recon_log (cobranca_data, nome, valor, resultado, transaction_id, deal_id, detalhe)
        VALUES (((c->>'sale_date')::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date, c->>'customer_name',
                (c->>'valor')::numeric, 'substituida_por_webhook', (c->>'id')::uuid,
                nullif(c->>'linked_deal_id','')::uuid, 'venda mcfpay equivalente encontrada');
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'processadas', jsonb_array_length(coalesce(p_cobrancas,'[]'::jsonb)),
    'resumo', (SELECT jsonb_object_agg(resultado, n) FROM (
        SELECT (x->>'resultado') AS resultado, count(*) AS n
        FROM jsonb_array_elements(v_out) x GROUP BY 1) y),
    'itens', v_out
  );
END;
$$;

REVOKE ALL ON FUNCTION public.asaas_caucao_recon(jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.asaas_caucao_recon(jsonb) TO service_role;
