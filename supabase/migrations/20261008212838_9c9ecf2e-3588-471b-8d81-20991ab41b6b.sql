CREATE OR REPLACE FUNCTION public.pos_venda_encaminhar_bu(p_deal_id uuid, p_bu text, p_nota text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d crm_deals%ROWTYPE; v_origin uuid; v_stage uuid; v_stage_name text; v_new uuid; v_exist uuid; v_label text;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente_relacionamento')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_bu = 'consorcio' THEN v_origin := '57013597-22f6-4969-848c-404b81dcc0cb'; v_stage_name := 'Novo Lead'; v_label := 'Consórcio';
  ELSIF p_bu = 'credito' THEN v_origin := 'c4ed1700-0000-4000-8000-000000000002'; v_stage_name := 'Em contato'; v_label := 'Crédito Imobiliário';
  ELSE RAISE EXCEPTION 'BU inválida'; END IF;
  SELECT * INTO d FROM crm_deals WHERE id = p_deal_id AND origin_id = 'b05a0000-0000-4000-8000-000000000002';
  IF NOT FOUND THEN RAISE EXCEPTION 'Card não é do Pós Venda'; END IF;
  SELECT id INTO v_stage FROM crm_stages WHERE origin_id = v_origin AND stage_name = v_stage_name AND coalesce(is_active,true) LIMIT 1;
  IF v_stage IS NULL THEN RAISE EXCEPTION 'Etapa de entrada não encontrada em %', v_label; END IF;
  PERFORM pos_venda_registrar_nota(p_deal_id, p_nota);
  SELECT id INTO v_exist FROM crm_deals WHERE origin_id = v_origin AND contact_id = d.contact_id AND coalesce(is_archived,false) = false LIMIT 1;
  IF v_exist IS NULL THEN
    INSERT INTO crm_deals (clint_id, name, contact_id, origin_id, stage_id, value, product_name, data_source, tags,
      replicated_from_deal_id, replicated_at, custom_fields)
    VALUES ('pos-venda-enc-'||gen_random_uuid(), d.name, d.contact_id, v_origin, v_stage, coalesce(d.value,0), d.product_name, 'replication',
      ARRAY['Veio do Pós Venda'], p_deal_id, now(),
      jsonb_build_object('origem_pos_venda_deal_id', p_deal_id, 'encaminhado_pos_venda', jsonb_build_object('nota',trim(p_nota),'por',auth.uid(),'em',now())))
    RETURNING id INTO v_new;
  ELSE v_new := v_exist; END IF;
  UPDATE crm_deals SET tags = array_append(coalesce(tags,'{}'), 'Encaminhado: '||v_label),
    custom_fields = coalesce(custom_fields,'{}'::jsonb) || jsonb_build_object('pos_venda_destino', p_bu, 'pos_venda_destino_em', now(),
      'pos_venda_destino_por', auth.uid(), 'pos_venda_destino_deal_id', v_new, 'pos_venda_destino_reaproveitado', v_exist IS NOT NULL)
   WHERE id = p_deal_id;
  INSERT INTO deal_activities (deal_id, activity_type, description, user_id, metadata)
  VALUES (p_deal_id::text, 'pos_venda_envio', 'Encaminhado para '||v_label||CASE WHEN v_exist IS NOT NULL THEN ' (cliente já tinha card lá)' ELSE '' END,
    auth.uid(), jsonb_build_object('destino',p_bu,'deal_destino',v_new));
  INSERT INTO crm_cliente_timeline (contact_id, deal_id, evento, origin_de, origin_para, stage_de, stage_para, deal_destino_id, nota, actor_id)
  VALUES (d.contact_id, p_deal_id, 'encaminhado_bu', d.origin_id, v_origin, d.stage_id, v_stage, v_new, trim(p_nota), auth.uid());
  RETURN v_new;
END $$;
REVOKE EXECUTE ON FUNCTION public.pos_venda_encaminhar_bu(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_encaminhar_bu(uuid,text,text) TO authenticated;