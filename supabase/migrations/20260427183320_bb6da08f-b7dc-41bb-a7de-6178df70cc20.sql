-- Função que serializa inserts do mesmo email/telefone e impede duplicação ativa
CREATE OR REPLACE FUNCTION public.prevent_duplicate_crm_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_norm  text;
  v_phone9      text;
  v_existing_id uuid;
BEGIN
  -- Só atua em contato ativo
  IF coalesce(NEW.is_archived, false) = true OR NEW.merged_into_contact_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_email_norm := nullif(lower(btrim(NEW.email)), '');
  v_phone9     := right(regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g'), 9);
  IF length(v_phone9) < 9 THEN v_phone9 := NULL; END IF;

  -- Serializa inserts concorrentes da mesma chave (email e telefone)
  IF v_email_norm IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('crm_contact_email:' || v_email_norm, 0));
  END IF;
  IF v_phone9 IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('crm_contact_phone:' || v_phone9, 0));
  END IF;

  -- Após o lock, verifica se já existe ativo
  IF v_email_norm IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.crm_contacts
    WHERE lower(btrim(email)) = v_email_norm
      AND coalesce(is_archived, false) = false
      AND merged_into_contact_id IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'duplicate_contact:email:%:%', v_email_norm, v_existing_id
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  IF v_phone9 IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.crm_contacts
    WHERE right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = v_phone9
      AND coalesce(is_archived, false) = false
      AND merged_into_contact_id IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'duplicate_contact:phone:%:%', v_phone9, v_existing_id
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_crm_contact ON public.crm_contacts;
CREATE TRIGGER trg_prevent_duplicate_crm_contact
BEFORE INSERT ON public.crm_contacts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_crm_contact();