CREATE OR REPLACE FUNCTION public.find_or_create_crm_contact(
  p_email      text,
  p_phone      text,
  p_name       text,
  p_origin_id  uuid,
  p_clint_id   text DEFAULT NULL,
  p_tags       text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_norm text;
  v_phone_norm text;
  v_phone9     text;
  v_existing_id uuid;
  v_new_id     uuid;
BEGIN
  v_email_norm := nullif(lower(btrim(p_email)), '');
  v_phone_norm := nullif(regexp_replace(coalesce(p_phone, ''), '\s+', '', 'g'), '');
  v_phone9     := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9);
  IF length(v_phone9) < 9 THEN v_phone9 := NULL; END IF;

  -- Serializa concorrentes da mesma chave
  IF v_email_norm IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('crm_contact_email:' || v_email_norm, 0));
  END IF;
  IF v_phone9 IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('crm_contact_phone:' || v_phone9, 0));
  END IF;

  -- 1) Tenta achar por email
  IF v_email_norm IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.crm_contacts
    WHERE lower(btrim(email)) = v_email_norm
      AND coalesce(is_archived, false) = false
      AND merged_into_contact_id IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- 2) Tenta achar por telefone
  IF v_existing_id IS NULL AND v_phone9 IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.crm_contacts
    WHERE right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = v_phone9
      AND coalesce(is_archived, false) = false
      AND merged_into_contact_id IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Se achou, enriquece campos vazios e retorna
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.crm_contacts SET
      email = COALESCE(NULLIF(btrim(email), ''), v_email_norm),
      phone = COALESCE(NULLIF(phone, ''), v_phone_norm),
      name  = COALESCE(NULLIF(btrim(name), ''), btrim(p_name)),
      tags  = CASE
                WHEN p_tags IS NULL OR array_length(p_tags,1) IS NULL THEN tags
                ELSE (
                  SELECT array_agg(DISTINCT t)
                  FROM unnest(coalesce(tags, ARRAY[]::text[]) || p_tags) AS t
                )
              END,
      updated_at = now()
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  -- Cria novo
  INSERT INTO public.crm_contacts (clint_id, name, email, phone, origin_id, tags)
  VALUES (
    COALESCE(p_clint_id, 'auto-' || extract(epoch from now())::text || '-' || substr(md5(random()::text),1,8)),
    btrim(p_name),
    v_email_norm,
    v_phone_norm,
    p_origin_id,
    COALESCE(p_tags, ARRAY[]::text[])
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_crm_contact(text,text,text,uuid,text,text[]) TO authenticated, anon, service_role;