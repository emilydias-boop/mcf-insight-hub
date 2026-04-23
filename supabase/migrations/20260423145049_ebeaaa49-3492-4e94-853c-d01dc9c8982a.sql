-- Function 1: Returns all contact IDs that are duplicates (share email or phone suffix with another active contact)
CREATE OR REPLACE FUNCTION public.get_duplicate_contact_ids()
RETURNS TABLE(contact_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sufixos AS (
    SELECT id,
           lower(email) AS email_norm,
           right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) AS phone_suf
    FROM crm_contacts
    WHERE coalesce(is_archived, false) = false
  ),
  dups_email AS (
    SELECT id FROM sufixos
    WHERE email_norm IS NOT NULL AND email_norm <> ''
      AND email_norm IN (
        SELECT email_norm FROM sufixos
        WHERE email_norm IS NOT NULL AND email_norm <> ''
        GROUP BY email_norm
        HAVING count(*) > 1
      )
  ),
  dups_phone AS (
    SELECT id FROM sufixos
    WHERE length(phone_suf) = 9
      AND phone_suf IN (
        SELECT phone_suf FROM sufixos
        WHERE length(phone_suf) = 9
        GROUP BY phone_suf
        HAVING count(*) > 1
      )
  )
  SELECT id FROM dups_email
  UNION
  SELECT id FROM dups_phone;
$$;

-- Function 2: Check if a contact already exists by email or phone suffix
-- Returns the existing contact info so caller can use it instead of creating a duplicate
CREATE OR REPLACE FUNCTION public.check_duplicate_contact_by_identity(
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS TABLE(
  contact_id uuid,
  contact_name text,
  contact_email text,
  contact_phone text,
  match_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_norm text;
  v_phone_suf text;
BEGIN
  v_email_norm := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_phone_suf := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9);

  -- Priority 1: exact email match
  IF v_email_norm IS NOT NULL THEN
    RETURN QUERY
      SELECT c.id, c.name, c.email, c.phone, 'email'::text
      FROM crm_contacts c
      WHERE coalesce(c.is_archived, false) = false
        AND lower(c.email) = v_email_norm
      ORDER BY c.created_at ASC
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 2: phone suffix match (9 digits)
  IF length(v_phone_suf) = 9 THEN
    RETURN QUERY
      SELECT c.id, c.name, c.email, c.phone, 'phone'::text
      FROM crm_contacts c
      WHERE coalesce(c.is_archived, false) = false
        AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 9) = v_phone_suf
      ORDER BY c.created_at ASC
      LIMIT 1;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_duplicate_contact_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_duplicate_contact_by_identity(text, text) TO authenticated;