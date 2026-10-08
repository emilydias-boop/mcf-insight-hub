CREATE OR REPLACE FUNCTION public.pos_venda_registrar_cliente(p_email text, p_phone text, p_name text, p_product_code text, p_product_name text, p_amount numeric, p_paid_at timestamp with time zone, p_fonte text, p_transaction_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_origin uuid := 'b05a0000-0000-4000-8000-000000000002';
  v_stage uuid := 'b05a0001-0000-4000-8000-000000000000';
  v_email text := nullif(lower(trim(coalesce(p_email,''))),'');
  v_suf text := right(regexp_replace(coalesce(p_phone,''),'\D','','g'),9);
  v_first text := lower(split_part(trim(coalesce(p_name,'')),' ',1));
  v_contact uuid; v_deal uuid; v_cf jsonb; v_compra jsonb; v_owner uuid; v_owner_email text; v_aviso text;
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
    BEGIN
      INSERT INTO crm_contacts (clint_id, name, email, phone, origin_id)
      VALUES ('pos-venda-'||gen_random_uuid(), coalesce(nullif(trim(p_name),''), v_email, 'Cliente'), v_email, p_phone, v_origin)
      RETURNING id INTO v_contact;
    EXCEPTION WHEN OTHERS THEN
      -- a regra geral do CRM não deixa repetir telefone: usa o cadastro existente e avisa
      SELECT id INTO v_contact FROM crm_contacts
       WHERE merged_into_contact_id IS NULL AND length(v_suf) = 9
         AND right(regexp_replace(coalesce(phone,''),'\D','','g'),9) = v_suf
       ORDER BY created_at LIMIT 1;
      IF v_contact IS NULL THEN RAISE; END IF;
      v_aviso := 'telefone_de_outro_cadastro';
    END;
  END IF;

  v_owner := pos_venda_escolher_gerente();
  IF v_owner IS NOT NULL THEN SELECT email INTO v_owner_email FROM profiles WHERE id = v_owner; END IF;

  INSERT INTO crm_deals (clint_id, name, contact_id, origin_id, stage_id, value, product_name, data_source, tags, custom_fields, owner_profile_id, owner_id)
  VALUES ('pos-venda-'||gen_random_uuid(), coalesce(nullif(trim(p_name),''), v_email, 'Cliente'), v_contact, v_origin, v_stage,
    p_amount, p_product_name, 'webhook', ARRAY['Pós Venda','Novo licenciado', coalesce(p_product_code,'MCF')],
    jsonb_build_object('pos_venda_compras', jsonb_build_array(v_compra), 'pos_venda_entrada_em', now(), 'pos_venda_fonte', p_fonte)
      || CASE WHEN v_aviso IS NOT NULL THEN jsonb_build_object('pos_venda_aviso', v_aviso, 'comprador_email', v_email, 'comprador_telefone', p_phone) ELSE '{}'::jsonb END,
    v_owner, v_owner_email)
  RETURNING id INTO v_deal;

  INSERT INTO deal_activities (deal_id, activity_type, description, to_stage, metadata)
  VALUES (v_deal::text, 'pos_venda_entrada', 'Cliente entrou no Pós Venda pela compra de '||coalesce(p_product_name,p_product_code,'produto MCF')||' ('||coalesce(p_fonte,'venda')||')',
    'Novos licenciados', v_compra);
  INSERT INTO crm_cliente_timeline (contact_id, deal_id, evento, origin_para, stage_para, metadata)
  VALUES (v_contact, v_deal, 'entrada_venda', v_origin, v_stage, v_compra || jsonb_build_object('gerente', v_owner));

  BEGIN PERFORM pos_venda_aplicar_anamnese_pendente(v_deal); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN jsonb_build_object('ok',true,'deal_id',v_deal,'acao','criado','gerente',v_owner);
END $function$;
REVOKE EXECUTE ON FUNCTION public.pos_venda_registrar_cliente(text,text,text,text,text,numeric,timestamptz,text,text) FROM PUBLIC, anon, authenticated;