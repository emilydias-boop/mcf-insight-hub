CREATE OR REPLACE FUNCTION public.get_merge_groups_strict(p_batch_size integer DEFAULT 50)
RETURNS TABLE(phone_suffix text, contact_ids uuid[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH grp AS (
    SELECT
      lower(btrim(email)) AS email_norm,
      RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 9) AS psuffix,
      array_agg(id ORDER BY created_at ASC) AS cids
    FROM public.crm_contacts
    WHERE phone IS NOT NULL
      AND email IS NOT NULL
      AND btrim(email) <> ''
      AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 9
      AND coalesce(is_archived,false) = false
      AND merged_into_contact_id IS NULL
    GROUP BY email_norm, psuffix
    HAVING COUNT(*) > 1
  )
  SELECT psuffix AS phone_suffix, cids AS contact_ids
  FROM grp
  ORDER BY array_length(cids, 1) DESC
  LIMIT p_batch_size;
$$;

GRANT EXECUTE ON FUNCTION public.get_merge_groups_strict(integer) TO authenticated, service_role;