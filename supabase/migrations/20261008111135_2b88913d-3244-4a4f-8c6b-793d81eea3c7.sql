UPDATE public.crm_stages SET is_won_stage = false WHERE id = 'b05a0001-0000-4000-8000-000000000003';

CREATE TABLE public.pos_venda_anamnese_pendente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone_suffix text,
  external_id text,
  anamnese jsonb NOT NULL,
  aplicada_em timestamptz,
  deal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pv_anam_email ON public.pos_venda_anamnese_pendente(email) WHERE aplicada_em IS NULL;
CREATE INDEX idx_pv_anam_phone ON public.pos_venda_anamnese_pendente(phone_suffix) WHERE aplicada_em IS NULL;
GRANT SELECT ON public.pos_venda_anamnese_pendente TO authenticated;
GRANT ALL ON public.pos_venda_anamnese_pendente TO service_role;
ALTER TABLE public.pos_venda_anamnese_pendente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin le anamnese pendente" ON public.pos_venda_anamnese_pendente FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.pos_venda_aplicar_anamnese_pendente(p_deal_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_suf text; v_p record;
BEGIN
  SELECT lower(trim(c.email)), right(regexp_replace(coalesce(c.phone,''),'\D','','g'),9)
    INTO v_email, v_suf
  FROM crm_deals d JOIN crm_contacts c ON c.id = d.contact_id WHERE d.id = p_deal_id;
  SELECT * INTO v_p FROM pos_venda_anamnese_pendente
   WHERE aplicada_em IS NULL
     AND ((coalesce(v_email,'') <> '' AND email = v_email)
       OR (length(coalesce(v_suf,'')) = 9 AND phone_suffix = v_suf))
   ORDER BY created_at DESC LIMIT 1;
  IF v_p.id IS NULL THEN RETURN false; END IF;
  UPDATE crm_deals SET custom_fields = coalesce(custom_fields,'{}'::jsonb) || jsonb_build_object('anamnese_v2', v_p.anamnese, 'anamnese_fonte', 'harvey_pos_venda')
   WHERE id = p_deal_id;
  UPDATE pos_venda_anamnese_pendente SET aplicada_em = now(), deal_id = p_deal_id WHERE id = v_p.id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.pos_venda_registrar_cliente(
  p_email text, p_phone text, p_name text, p_product_code text, p_product_name text,
  p_amount numeric, p_paid_at timestamptz, p_fonte text, p_transaction_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_origin uuid := 'b05a0000-0000-4000-8000-000000000002';
  v_stage uuid := 'b05a0001-0000-4000-8000-000000000001';
  v_email text := nullif(lower(trim(coalesce(p_email,''))),'');
  v_suf text := right(regexp_replace(coalesce(p_phone,''),'\D','','g'),9);
  v_contact uuid; v_deal uuid; v_cf jsonb; v_compra jsonb;
BEGIN
  IF v_email IS NULL AND length(v_suf) < 9 THEN RETURN jsonb_build_object('ok',false,'motivo','sem_identificacao'); END IF;
  v_compra := jsonb_build_object('produto_codigo',p_product_code,'produto',p_product_name,'valor',p_amount,
    'pago_em',p_paid_at,'fonte',p_fonte,'transacao',p_transaction_id);

  SELECT d.id, d.custom_fields INTO v_deal, v_cf FROM crm_deals d JOIN crm_contacts c ON c.id = d.contact_id
   WHERE d.origin_id = v_origin AND coalesce(d.is_archived,false) = false
     AND ((v_email IS NOT NULL AND lower(trim(c.email)) = v_email)
       OR (length(v_suf) = 9 AND right(regexp_replace(coalesce(c.phone,''),'\D','','g'),9) = v_suf))
   ORDER BY d.created_at LIMIT 1;

  IF v_deal IS NOT NULL THEN
    IF coalesce(v_cf->'pos_venda_compras','[]'::jsonb) @> jsonb_build_array(jsonb_build_object('transacao',p_transaction_id)) THEN
      RETURN jsonb_build_object('ok',true,'deal_id',v_deal,'acao','ja_registrado');
    END IF;
    UPDATE crm_deals SET custom_fields = coalesce(custom_fields,'{}'::jsonb)
      || jsonb_build_object('pos_venda_compras', coalesce(custom_fields->'pos_venda_compras','[]'::jsonb) || jsonb_build_array(v_compra))
     WHERE id = v_deal;
    RETURN jsonb_build_object('ok',true,'deal_id',v_deal,'acao','compra_adicionada');
  END IF;

  SELECT id INTO v_contact FROM crm_contacts
   WHERE merged_into_contact_id IS NULL AND coalesce(is_archived,false) = false
     AND ((v_email IS NOT NULL AND lower(trim(email)) = v_email)
       OR (length(v_suf) = 9 AND right(regexp_replace(coalesce(phone,''),'\D','','g'),9) = v_suf))
   ORDER BY created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO crm_contacts (clint_id, name, email, phone, origin_id)
    VALUES ('pos-venda-'||gen_random_uuid(), coalesce(nullif(trim(p_name),''), v_email, 'Cliente'), v_email, p_phone, v_origin)
    RETURNING id INTO v_contact;
  END IF;

  INSERT INTO crm_deals (clint_id, name, contact_id, origin_id, stage_id, value, product_name, data_source, tags, custom_fields)
  VALUES ('pos-venda-'||gen_random_uuid(), coalesce(nullif(trim(p_name),''), v_email, 'Cliente'), v_contact, v_origin, v_stage,
    p_amount, p_product_name, 'pos_venda_'||coalesce(p_fonte,'venda'), ARRAY['Pós Venda', coalesce(p_product_code,'MCF')],
    jsonb_build_object('pos_venda_compras', jsonb_build_array(v_compra), 'pos_venda_entrada_em', now()))
  RETURNING id INTO v_deal;

  INSERT INTO deal_activities (deal_id, activity_type, description, to_stage, metadata)
  VALUES (v_deal::text, 'pos_venda_entrada', 'Cliente entrou no Pós Venda pela compra de '||coalesce(p_product_name,p_product_code,'produto MCF')||' ('||coalesce(p_fonte,'venda')||')',
    'Reunião de Viabilidade 1', v_compra);

  PERFORM pos_venda_aplicar_anamnese_pendente(v_deal);
  RETURN jsonb_build_object('ok',true,'deal_id',v_deal,'acao','criado');
END $$;

CREATE OR REPLACE FUNCTION public.pos_venda_on_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  BEGIN
    IF coalesce(NEW.sale_status,'') <> 'completed' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.sale_status = 'completed' THEN RETURN NEW; END IF;
    IF coalesce(NEW.is_offer,false) THEN RETURN NEW; END IF;
    IF coalesce(NEW.installment_number,1) > 1 THEN RETURN NEW; END IF;
    v_code := upper(coalesce(nullif(NEW.product_code,''), substring(NEW.product_name from '(?i)(A00[1349])')));
    IF v_code IS NULL OR v_code NOT IN ('A001','A003','A004','A009') THEN RETURN NEW; END IF;
    PERFORM pos_venda_registrar_cliente(NEW.customer_email, NEW.customer_phone, NEW.customer_name, v_code,
      NEW.product_name, coalesce(NEW.product_price, NEW.net_value), coalesce(NEW.sale_date, now()),
      coalesce(NEW.source,'hubla'), coalesce(NEW.hubla_id, NEW.id::text));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pos_venda_on_venda falhou (venda segue normal): %', SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER zzz_pos_venda_entrada AFTER INSERT OR UPDATE OF sale_status ON public.hubla_transactions
FOR EACH ROW EXECUTE FUNCTION public.pos_venda_on_venda();

CREATE OR REPLACE FUNCTION public.pos_venda_concluir_viabilidade(p_deal_id uuid, p_destino text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deal crm_deals%ROWTYPE;
  v_dest_origin uuid; v_dest_stage uuid; v_dest_stage_name text; v_new uuid; v_existente uuid;
BEGIN
  IF v_uid IS NULL OR NOT (has_role(v_uid,'admin') OR has_role(v_uid,'gerente_relacionamento')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO v_deal FROM crm_deals WHERE id = p_deal_id;
  IF v_deal.origin_id IS DISTINCT FROM 'b05a0000-0000-4000-8000-000000000002'::uuid THEN
    RAISE EXCEPTION 'Negócio não é da pipeline Pós Venda';
  END IF;
  IF coalesce(v_deal.custom_fields,'{}'::jsonb) ? 'pos_venda_destino' THEN
    RAISE EXCEPTION 'Este cliente já foi enviado para %', v_deal.custom_fields->>'pos_venda_destino';
  END IF;
  IF p_destino = 'credito' THEN
    v_dest_origin := 'c4ed1700-0000-4000-8000-000000000002'; v_dest_stage_name := 'Em contato';
  ELSIF p_destino = 'consorcio' THEN
    v_dest_origin := '57013597-22f6-4969-848c-404b81dcc0cb'; v_dest_stage_name := 'Novo Lead';
  ELSE RAISE EXCEPTION 'Destino inválido'; END IF;
  SELECT id INTO v_dest_stage FROM crm_stages WHERE origin_id = v_dest_origin AND stage_name = v_dest_stage_name AND is_active LIMIT 1;
  IF v_dest_stage IS NULL THEN RAISE EXCEPTION 'Etapa de entrada não encontrada no destino'; END IF;

  UPDATE crm_deals SET stage_id = 'b05a0001-0000-4000-8000-000000000003' WHERE id = p_deal_id;

  SELECT id INTO v_existente FROM crm_deals
   WHERE origin_id = v_dest_origin AND contact_id = v_deal.contact_id AND coalesce(is_archived,false) = false LIMIT 1;
  IF v_existente IS NULL THEN
    INSERT INTO crm_deals (clint_id, name, contact_id, origin_id, stage_id, value, product_name, data_source, tags, custom_fields)
    VALUES ('pos-venda-envio-'||gen_random_uuid(), v_deal.name, v_deal.contact_id, v_dest_origin, v_dest_stage,
      v_deal.value, v_deal.product_name, 'pos_venda', ARRAY['Veio do Pós Venda'],
      jsonb_build_object('origem_pos_venda_deal_id', p_deal_id) ||
        CASE WHEN coalesce(v_deal.custom_fields,'{}'::jsonb) ? 'anamnese_v2' THEN jsonb_build_object('anamnese_v2', v_deal.custom_fields->'anamnese_v2') ELSE '{}'::jsonb END)
    RETURNING id INTO v_new;
  ELSE
    v_new := v_existente;
  END IF;

  UPDATE crm_deals SET custom_fields = coalesce(custom_fields,'{}'::jsonb) || jsonb_build_object(
    'pos_venda_destino', p_destino, 'pos_venda_destino_em', now(), 'pos_venda_destino_por', v_uid,
    'pos_venda_destino_deal_id', v_new, 'pos_venda_destino_reaproveitado', v_existente IS NOT NULL)
   WHERE id = p_deal_id;

  INSERT INTO deal_activities (deal_id, activity_type, description, user_id, metadata)
  VALUES (p_deal_id::text, 'pos_venda_envio',
    'Enviado para '||CASE p_destino WHEN 'credito' THEN 'Crédito Imobiliário' ELSE 'Consórcio' END
      ||CASE WHEN v_existente IS NOT NULL THEN ' (cliente já tinha card lá)' ELSE '' END,
    v_uid, jsonb_build_object('destino',p_destino,'deal_destino',v_new));
  RETURN jsonb_build_object('ok',true,'deal_destino',v_new,'reaproveitado',v_existente IS NOT NULL);
END $$;

REVOKE EXECUTE ON FUNCTION public.pos_venda_aplicar_anamnese_pendente(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pos_venda_registrar_cliente(text,text,text,text,text,numeric,timestamptz,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pos_venda_on_venda() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pos_venda_concluir_viabilidade(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_concluir_viabilidade(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_venda_aplicar_anamnese_pendente(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pos_venda_registrar_cliente(text,text,text,text,text,numeric,timestamptz,text,text) TO service_role;