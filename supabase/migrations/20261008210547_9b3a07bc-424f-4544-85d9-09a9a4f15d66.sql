
INSERT INTO public.crm_stages (id, clint_id, stage_name, stage_order, origin_id, color, is_active)
VALUES ('b05a0001-0000-4000-8000-000000000000','pos-venda-novos-licenciados','Novos licenciados',0,'b05a0000-0000-4000-8000-000000000002','#C8FF00',true)
ON CONFLICT (id) DO NOTHING;

-- Distribuição
CREATE TABLE public.pos_venda_distribuicao (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  percentual numeric(5,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  recebidos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pos_venda_distribuicao TO authenticated;
GRANT ALL ON public.pos_venda_distribuicao TO service_role;
ALTER TABLE public.pos_venda_distribuicao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pv_distrib_select" ON public.pos_venda_distribuicao FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente_relacionamento'));
CREATE TRIGGER trg_pv_distrib_updated BEFORE UPDATE ON public.pos_venda_distribuicao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.pos_venda_salvar_distribuicao(p_itens jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_soma numeric; v_ativos int;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Somente administradores podem alterar a distribuição'; END IF;
  SELECT coalesce(sum((i->>'percentual')::numeric),0), count(*) INTO v_soma, v_ativos
    FROM jsonb_array_elements(p_itens) i WHERE coalesce((i->>'ativo')::boolean,false);
  IF v_ativos = 0 OR v_soma <> 100 THEN RAISE EXCEPTION 'A soma dos gerentes ativos precisa dar 100%% (deu %)', v_soma; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_itens) i
     WHERE NOT has_role((i->>'profile_id')::uuid,'gerente_relacionamento')) THEN
    RAISE EXCEPTION 'Só gerentes de relacionamento podem receber clientes';
  END IF;
  INSERT INTO pos_venda_distribuicao (profile_id, percentual, ativo)
  SELECT (i->>'profile_id')::uuid, coalesce((i->>'percentual')::numeric,0), coalesce((i->>'ativo')::boolean,false)
    FROM jsonb_array_elements(p_itens) i
  ON CONFLICT (profile_id) DO UPDATE SET percentual = excluded.percentual, ativo = excluded.ativo;
END $$;
REVOKE EXECUTE ON FUNCTION public.pos_venda_salvar_distribuicao(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_salvar_distribuicao(jsonb) TO authenticated;

-- Escolhe gerente pelo maior déficit em relação ao %
CREATE OR REPLACE FUNCTION public.pos_venda_escolher_gerente()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int; v_pid uuid;
BEGIN
  SELECT coalesce(sum(recebidos),0) INTO v_total FROM pos_venda_distribuicao WHERE ativo AND percentual > 0;
  SELECT profile_id INTO v_pid FROM pos_venda_distribuicao WHERE ativo AND percentual > 0
   ORDER BY (percentual/100.0)*(v_total+1) - recebidos DESC, percentual DESC, profile_id
   LIMIT 1 FOR UPDATE;
  IF v_pid IS NOT NULL THEN UPDATE pos_venda_distribuicao SET recebidos = recebidos + 1 WHERE profile_id = v_pid; END IF;
  RETURN v_pid;
END $$;
REVOKE EXECUTE ON FUNCTION public.pos_venda_escolher_gerente() FROM PUBLIC, anon, authenticated;

-- Linha do tempo
CREATE TABLE public.crm_cliente_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid,
  deal_id uuid,
  evento text NOT NULL,
  origin_de uuid, origin_para uuid,
  stage_de uuid, stage_para uuid,
  deal_destino_id uuid,
  nota text,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.crm_cliente_timeline (contact_id, created_at);
CREATE INDEX ON public.crm_cliente_timeline (deal_id, created_at);
GRANT SELECT ON public.crm_cliente_timeline TO authenticated;
GRANT ALL ON public.crm_cliente_timeline TO service_role;
ALTER TABLE public.crm_cliente_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timeline_select" ON public.crm_cliente_timeline FOR SELECT TO authenticated USING (true);

-- Falhas de entrada
CREATE TABLE public.pos_venda_entrada_falhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id uuid, erro text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pos_venda_entrada_falhas TO authenticated;
GRANT ALL ON public.pos_venda_entrada_falhas TO service_role;
ALTER TABLE public.pos_venda_entrada_falhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pv_falhas_admin" ON public.pos_venda_entrada_falhas FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Entrada do cliente
CREATE OR REPLACE FUNCTION public.pos_venda_registrar_cliente(p_email text, p_phone text, p_name text, p_product_code text, p_product_name text, p_amount numeric, p_paid_at timestamp with time zone, p_fonte text, p_transaction_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_origin uuid := 'b05a0000-0000-4000-8000-000000000002';
  v_stage uuid := 'b05a0001-0000-4000-8000-000000000000';
  v_email text := nullif(lower(trim(coalesce(p_email,''))),'');
  v_suf text := right(regexp_replace(coalesce(p_phone,''),'\D','','g'),9);
  v_first text := lower(split_part(trim(coalesce(p_name,'')),' ',1));
  v_contact uuid; v_deal uuid; v_cf jsonb; v_compra jsonb; v_owner uuid; v_owner_email text;
BEGIN
  IF v_email IS NULL AND length(v_suf) < 9 THEN RETURN jsonb_build_object('ok',false,'motivo','sem_identificacao'); END IF;
  v_compra := jsonb_build_object('produto_codigo',p_product_code,'produto',p_product_name,'valor',p_amount,
    'pago_em',p_paid_at,'fonte',p_fonte,'transacao',p_transaction_id);

  SELECT d.id, d.custom_fields, d.contact_id INTO v_deal, v_cf, v_contact FROM crm_deals d JOIN crm_contacts c ON c.id = d.contact_id
   WHERE d.origin_id = v_origin AND coalesce(d.is_archived,false) = false
     AND ((v_email IS NOT NULL AND lower(trim(c.email)) = v_email)
       OR (length(v_suf) = 9 AND right(regexp_replace(coalesce(c.phone,''),'\D','','g'),9) = v_suf
           AND v_first <> '' AND lower(split_part(trim(c.name),' ',1)) = v_first))
   ORDER BY d.created_at LIMIT 1;

  IF v_deal IS NOT NULL THEN
    IF coalesce(v_cf->'pos_venda_compras','[]'::jsonb) @> jsonb_build_array(jsonb_build_object('transacao',p_transaction_id)) THEN
      RETURN jsonb_build_object('ok',true,'deal_id',v_deal,'acao','ja_registrado');
    END IF;
    UPDATE crm_deals SET custom_fields = coalesce(custom_fields,'{}'::jsonb)
      || jsonb_build_object('pos_venda_compras', coalesce(custom_fields->'pos_venda_compras','[]'::jsonb) || jsonb_build_array(v_compra))
     WHERE id = v_deal;
    INSERT INTO crm_cliente_timeline (contact_id, deal_id, evento, origin_para, metadata)
    VALUES (v_contact, v_deal, 'nova_compra', v_origin, v_compra);
    RETURN jsonb_build_object('ok',true,'deal_id',v_deal,'acao','compra_adicionada');
  END IF;

  SELECT id INTO v_contact FROM crm_contacts c
   WHERE merged_into_contact_id IS NULL AND coalesce(is_archived,false) = false
     AND ((v_email IS NOT NULL AND lower(trim(email)) = v_email)
       OR (length(v_suf) = 9 AND right(regexp_replace(coalesce(phone,''),'\D','','g'),9) = v_suf
           AND v_first <> '' AND lower(split_part(trim(c.name),' ',1)) = v_first))
   ORDER BY created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO crm_contacts (clint_id, name, email, phone, origin_id)
    VALUES ('pos-venda-'||gen_random_uuid(), coalesce(nullif(trim(p_name),''), v_email, 'Cliente'), v_email, p_phone, v_origin)
    RETURNING id INTO v_contact;
  END IF;

  v_owner := pos_venda_escolher_gerente();
  IF v_owner IS NOT NULL THEN SELECT email INTO v_owner_email FROM profiles WHERE id = v_owner; END IF;

  INSERT INTO crm_deals (clint_id, name, contact_id, origin_id, stage_id, value, product_name, data_source, tags, custom_fields, owner_profile_id, owner_id)
  VALUES ('pos-venda-'||gen_random_uuid(), coalesce(nullif(trim(p_name),''), v_email, 'Cliente'), v_contact, v_origin, v_stage,
    p_amount, p_product_name, 'webhook', ARRAY['Pós Venda','Novo licenciado', coalesce(p_product_code,'MCF')],
    jsonb_build_object('pos_venda_compras', jsonb_build_array(v_compra), 'pos_venda_entrada_em', now(), 'pos_venda_fonte', p_fonte),
    v_owner, v_owner_email)
  RETURNING id INTO v_deal;

  INSERT INTO deal_activities (deal_id, activity_type, description, to_stage, metadata)
  VALUES (v_deal::text, 'pos_venda_entrada', 'Cliente entrou no Pós Venda pela compra de '||coalesce(p_product_name,p_product_code,'produto MCF')||' ('||coalesce(p_fonte,'venda')||')',
    'Novos licenciados', v_compra);
  INSERT INTO crm_cliente_timeline (contact_id, deal_id, evento, origin_para, stage_para, actor_id, metadata)
  VALUES (v_contact, v_deal, 'entrada_venda', v_origin, v_stage, NULL, v_compra || jsonb_build_object('gerente', v_owner));

  BEGIN PERFORM pos_venda_aplicar_anamnese_pendente(v_deal); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN jsonb_build_object('ok',true,'deal_id',v_deal,'acao','criado','gerente',v_owner);
END $function$;

CREATE OR REPLACE FUNCTION public.pos_venda_on_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_code text; v_msg text;
BEGIN
  BEGIN
    IF coalesce(NEW.sale_status,'') <> 'completed' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.sale_status = 'completed' THEN RETURN NEW; END IF;
    IF coalesce(NEW.is_offer,false) THEN RETURN NEW; END IF;
    IF coalesce(NEW.installment_number,1) > 1 THEN RETURN NEW; END IF;
    IF coalesce(NEW.net_value,0) < 0 THEN RETURN NEW; END IF;
    IF coalesce(NEW.product_name,'') ~* 'renova' THEN RETURN NEW; END IF;
    v_code := upper(substring(coalesce(NEW.product_name,'') from '(?i)^\s*([AR]00[1-9])'));
    IF v_code IS NULL OR v_code NOT IN ('A001','A003','A004','A009','R001','R002','R004','R009') THEN RETURN NEW; END IF;
    PERFORM pos_venda_registrar_cliente(NEW.customer_email, NEW.customer_phone, NEW.customer_name, v_code,
      NEW.product_name, coalesce(NEW.product_price, NEW.net_value), coalesce(NEW.sale_date, now()),
      coalesce(NEW.source,'hubla'), coalesce(NEW.hubla_id, NEW.id::text));
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
    BEGIN INSERT INTO pos_venda_entrada_falhas (transacao_id, erro) VALUES (NEW.id, v_msg); EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE WARNING 'pos_venda_on_venda falhou (venda segue normal): %', v_msg;
  END;
  RETURN NEW;
END $function$;

-- Nota obrigatória para sair de Novos licenciados + linha do tempo de etapas
CREATE OR REPLACE FUNCTION public.pos_venda_checar_nota_novos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.stage_id = 'b05a0001-0000-4000-8000-000000000000' AND NOT EXISTS (
    SELECT 1 FROM deal_activities WHERE deal_id = NEW.id::text AND activity_type = 'pos_venda_nota_contato'
      AND created_at > now() - interval '15 minutes') THEN
    RAISE EXCEPTION 'Para tirar o card de Novos licenciados registre a nota do contato' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO crm_cliente_timeline (contact_id, deal_id, evento, origin_de, origin_para, stage_de, stage_para, actor_id)
  VALUES (NEW.contact_id, NEW.id, 'mudanca_etapa', OLD.origin_id, NEW.origin_id, OLD.stage_id, NEW.stage_id, auth.uid());
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pos_venda_nota_novos BEFORE UPDATE OF stage_id ON public.crm_deals FOR EACH ROW
WHEN (old.origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid AND old.stage_id IS DISTINCT FROM new.stage_id)
EXECUTE FUNCTION public.pos_venda_checar_nota_novos();

-- Registrar nota
CREATE OR REPLACE FUNCTION public.pos_venda_registrar_nota(p_deal_id uuid, p_nota text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contact uuid;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente_relacionamento')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF length(trim(coalesce(p_nota,''))) < 3 THEN RAISE EXCEPTION 'Escreva a nota do contato'; END IF;
  SELECT contact_id INTO v_contact FROM crm_deals WHERE id = p_deal_id AND origin_id = 'b05a0000-0000-4000-8000-000000000002';
  IF NOT FOUND THEN RAISE EXCEPTION 'Card não é do Pós Venda'; END IF;
  INSERT INTO deal_activities (deal_id, activity_type, description, user_id)
  VALUES (p_deal_id::text, 'pos_venda_nota_contato', trim(p_nota), auth.uid());
  INSERT INTO crm_cliente_timeline (contact_id, deal_id, evento, nota, actor_id)
  VALUES (v_contact, p_deal_id, 'nota_contato', trim(p_nota), auth.uid());
END $$;
REVOKE EXECUTE ON FUNCTION public.pos_venda_registrar_nota(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_registrar_nota(uuid,text) TO authenticated;

-- Encaminhar para outra BU
CREATE OR REPLACE FUNCTION public.pos_venda_encaminhar_bu(p_deal_id uuid, p_bu text, p_nota text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d crm_deals%ROWTYPE; v_origin uuid; v_stage uuid; v_new uuid; v_label text;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente_relacionamento')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_bu = 'consorcio' THEN v_origin := '7d7b1cb5-2a44-4552-9eff-c3b798646b78'; v_label := 'Consórcio';
  ELSIF p_bu = 'credito' THEN v_origin := 'c4ed1700-0000-4000-8000-000000000002'; v_label := 'Crédito Imobiliário';
  ELSE RAISE EXCEPTION 'BU inválida'; END IF;
  SELECT * INTO d FROM crm_deals WHERE id = p_deal_id AND origin_id = 'b05a0000-0000-4000-8000-000000000002';
  IF NOT FOUND THEN RAISE EXCEPTION 'Card não é do Pós Venda'; END IF;
  SELECT id INTO v_stage FROM crm_stages WHERE origin_id = v_origin AND coalesce(is_active,true) ORDER BY stage_order LIMIT 1;
  PERFORM pos_venda_registrar_nota(p_deal_id, p_nota);
  INSERT INTO crm_deals (clint_id, name, contact_id, origin_id, stage_id, value, product_name, data_source, tags,
    replicated_from_deal_id, replicated_at, custom_fields)
  VALUES ('pos-venda-enc-'||gen_random_uuid(), d.name, d.contact_id, v_origin, v_stage, 0, d.product_name, 'replication',
    ARRAY['Encaminhado Pós Venda'], p_deal_id, now(),
    jsonb_build_object('encaminhado_pos_venda', jsonb_build_object('deal_id',p_deal_id,'nota',trim(p_nota),'por',auth.uid(),'em',now())))
  RETURNING id INTO v_new;
  UPDATE crm_deals SET tags = array_append(coalesce(tags,'{}'), 'Encaminhado: '||v_label),
    custom_fields = coalesce(custom_fields,'{}'::jsonb) || jsonb_build_object('encaminhado_para', jsonb_build_object('bu',p_bu,'deal_id',v_new,'em',now()))
   WHERE id = p_deal_id;
  INSERT INTO deal_activities (deal_id, activity_type, description, user_id, metadata)
  VALUES (p_deal_id::text, 'pos_venda_encaminhado', 'Encaminhado para '||v_label, auth.uid(), jsonb_build_object('deal_destino', v_new));
  INSERT INTO crm_cliente_timeline (contact_id, deal_id, evento, origin_de, origin_para, stage_de, stage_para, deal_destino_id, nota, actor_id)
  VALUES (d.contact_id, p_deal_id, 'encaminhado_bu', d.origin_id, v_origin, d.stage_id, v_stage, v_new, trim(p_nota), auth.uid());
  RETURN v_new;
END $$;
REVOKE EXECUTE ON FUNCTION public.pos_venda_encaminhar_bu(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_encaminhar_bu(uuid,text,text) TO authenticated;
