ALTER TABLE public.pos_venda_anamnese_pendente ADD COLUMN IF NOT EXISTS harvey_cliente_id text, ADD COLUMN IF NOT EXISTS cpf text;
CREATE OR REPLACE FUNCTION public.pos_venda_aplicar_anamnese_pendente(p_deal_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_email text; v_suf text; v_hid text; v_cpf text; v_p record;
BEGIN
  SELECT lower(trim(c.email)), right(regexp_replace(coalesce(c.phone,''),'\D','','g'),9),
         d.custom_fields->>'harvey_cliente_id', regexp_replace(coalesce(d.custom_fields->>'cpf',''),'\D','','g')
    INTO v_email, v_suf, v_hid, v_cpf
  FROM crm_deals d JOIN crm_contacts c ON c.id = d.contact_id WHERE d.id = p_deal_id;
  SELECT * INTO v_p FROM pos_venda_anamnese_pendente
   WHERE aplicada_em IS NULL
     AND ((coalesce(v_hid,'') <> '' AND harvey_cliente_id = v_hid)
       OR (length(coalesce(v_cpf,'')) = 11 AND cpf = v_cpf)
       OR (coalesce(v_email,'') <> '' AND email = v_email)
       OR (length(coalesce(v_suf,'')) = 9 AND phone_suffix = v_suf))
   ORDER BY created_at DESC LIMIT 1;
  IF v_p.id IS NULL THEN RETURN false; END IF;
  UPDATE crm_deals SET custom_fields = coalesce(custom_fields,'{}'::jsonb) || jsonb_build_object('anamnese_v2', v_p.anamnese, 'anamnese_fonte', 'harvey_pos_venda')
   WHERE id = p_deal_id;
  UPDATE pos_venda_anamnese_pendente SET aplicada_em = now(), deal_id = p_deal_id WHERE id = v_p.id;
  RETURN true;
END $function$;