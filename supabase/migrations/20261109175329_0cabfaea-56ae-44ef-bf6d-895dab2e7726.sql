CREATE OR REPLACE FUNCTION public.pos_venda_encaminhar_bu(p_deal_id uuid, p_bu text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deal crm_deals%ROWTYPE;
  v_contact crm_contacts%ROWTYPE;
  v_origin uuid;
  v_stage uuid;
  v_dest uuid;
  v_criado boolean := false;
  v_email text;
  v_fone text;
  v_rotulo text;
  v_tag text;
BEGIN
  IF v_uid IS NULL OR NOT (has_role(v_uid, 'gerente_relacionamento') OR has_role(v_uid, 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão para encaminhar cliente para outra BU' USING ERRCODE = '42501';
  END IF;
  IF p_bu NOT IN ('consorcio', 'solar', 'credito') THEN
    RAISE EXCEPTION 'BU de destino inválida: %', p_bu;
  END IF;
  v_rotulo := CASE p_bu WHEN 'consorcio' THEN 'Consórcio' WHEN 'solar' THEN 'War Room' ELSE 'Crédito' END;
  v_tag := 'Encaminhado: ' || v_rotulo;

  SELECT * INTO v_deal FROM crm_deals WHERE id = p_deal_id;
  IF NOT FOUND OR v_deal.origin_id IS DISTINCT FROM 'b05a0000-0000-4000-8000-000000000002'::uuid THEN
    RAISE EXCEPTION 'Negócio não pertence ao Pós-venda';
  END IF;

  SELECT entity_id INTO v_origin FROM bu_origin_mapping
   WHERE bu = p_bu AND entity_type = 'origin' AND is_default IS TRUE LIMIT 1;
  IF v_origin IS NULL THEN RAISE EXCEPTION 'Funil padrão da BU % não encontrado', p_bu; END IF;

  IF v_deal.contact_id IS NOT NULL THEN
    SELECT * INTO v_contact FROM crm_contacts WHERE id = v_deal.contact_id;
  END IF;
  v_email := nullif(lower(trim(v_contact.email)), '');
  v_fone := nullif(right(regexp_replace(coalesce(v_contact.phone, ''), '\D', '', 'g'), 9), '');
  IF length(coalesce(v_fone, '')) < 9 THEN v_fone := NULL; END IF;

  SELECT d.id INTO v_dest
    FROM crm_deals d LEFT JOIN crm_contacts c ON c.id = d.contact_id
   WHERE d.origin_id = v_origin AND coalesce(d.is_archived, false) = false AND d.merged_into_deal_id IS NULL
     AND ((v_deal.contact_id IS NOT NULL AND d.contact_id = v_deal.contact_id)
       OR (v_email IS NOT NULL AND lower(trim(c.email)) = v_email)
       OR (v_fone IS NOT NULL AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 9) = v_fone))
   ORDER BY d.created_at DESC LIMIT 1;

  IF v_dest IS NULL THEN
    SELECT id INTO v_stage FROM crm_stages
     WHERE origin_id = v_origin AND coalesce(is_active, true) AND upper(stage_name) = 'ENCAMINHADO GR' LIMIT 1;
    IF v_stage IS NULL THEN
      SELECT id INTO v_stage FROM crm_stages
       WHERE origin_id = v_origin AND coalesce(is_active, true) ORDER BY stage_order LIMIT 1;
    END IF;
    INSERT INTO crm_deals (clint_id, name, contact_id, origin_id, stage_id, data_source, tags, replicated_from_deal_id, replicated_at, cpf)
    VALUES ('pos-venda-enc-' || gen_random_uuid(), v_deal.name, v_deal.contact_id, v_origin, v_stage, 'pos_venda_encaminhamento',
            ARRAY['Encaminhado pelo Pós-venda'], v_deal.id, now(), v_deal.cpf)
    RETURNING id INTO v_dest;
    v_criado := true;
  END IF;

  UPDATE crm_deals SET tags = array_append(coalesce(tags, '{}'), v_tag)
   WHERE id = v_deal.id AND NOT (v_tag = ANY(coalesce(tags, '{}')));

  INSERT INTO deal_activities (deal_id, activity_type, description, user_id, metadata)
  VALUES (v_deal.id::text, 'encaminhamento_bu', 'Encaminhado para ' || v_rotulo || ' pelo Pós-venda', v_uid,
          jsonb_build_object('tipo', 'encaminhamento_bu', 'bu', p_bu, 'deal_destino_id', v_dest, 'cartao_criado', v_criado));

  INSERT INTO crm_cliente_timeline (contact_id, deal_id, evento, origin_de, origin_para, deal_destino_id, nota, actor_id, metadata)
  VALUES (v_deal.contact_id, v_deal.id, 'encaminhamento_bu', v_deal.origin_id, v_origin, v_dest,
          'Encaminhado para ' || v_rotulo, v_uid, jsonb_build_object('bu', p_bu, 'cartao_criado', v_criado));

  RETURN v_dest;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_venda_encaminhar_bu(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_encaminhar_bu(uuid, text) TO authenticated, service_role;