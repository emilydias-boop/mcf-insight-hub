CREATE OR REPLACE FUNCTION public.pos_venda_concluir_viabilidade(p_deal_id uuid, p_destino text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    INSERT INTO crm_deals (clint_id, name, contact_id, origin_id, stage_id, value, product_name, data_source, tags,
      replicated_from_deal_id, replicated_at, custom_fields)
    VALUES ('pos-venda-envio-'||gen_random_uuid(), v_deal.name, v_deal.contact_id, v_dest_origin, v_dest_stage,
      coalesce(v_deal.value,0), v_deal.product_name, 'replication', ARRAY['Veio do Pós Venda'], p_deal_id, now(),
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
  INSERT INTO crm_cliente_timeline (contact_id, deal_id, evento, origin_de, origin_para, stage_de, stage_para, deal_destino_id, actor_id)
  VALUES (v_deal.contact_id, p_deal_id, 'encaminhado_bu', v_deal.origin_id, v_dest_origin, v_deal.stage_id, v_dest_stage, v_new, v_uid);
  RETURN jsonb_build_object('ok',true,'deal_destino',v_new,'reaproveitado',v_existente IS NOT NULL);
END $function$;