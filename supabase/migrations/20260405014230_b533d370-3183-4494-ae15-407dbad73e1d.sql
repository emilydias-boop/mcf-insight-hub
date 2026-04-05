
CREATE OR REPLACE FUNCTION public.get_merge_groups(p_batch_size integer DEFAULT 50)
RETURNS TABLE(phone_suffix text, contact_ids uuid[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH phone_groups AS (
    SELECT
      RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 9) AS psuffix,
      array_agg(id ORDER BY created_at ASC) as cids
    FROM crm_contacts
    WHERE phone IS NOT NULL
      AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 9
      AND is_archived = false
    GROUP BY psuffix
    HAVING COUNT(*) > 1
  )
  SELECT 
    pg.psuffix as phone_suffix,
    pg.cids as contact_ids
  FROM phone_groups pg
  WHERE EXISTS (
    SELECT 1 FROM crm_deals d 
    WHERE d.contact_id = ANY(pg.cids)
  )
  ORDER BY array_length(pg.cids, 1) DESC
  LIMIT p_batch_size;
$$;
