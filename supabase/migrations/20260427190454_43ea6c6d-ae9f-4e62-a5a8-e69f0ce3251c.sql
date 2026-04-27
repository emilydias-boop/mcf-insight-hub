WITH grp AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(email)),
                   RIGHT(REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g'), 9)
      ORDER BY created_at ASC
    ) AS rn,
    COUNT(*) OVER (
      PARTITION BY lower(btrim(email)),
                   RIGHT(REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g'), 9)
    ) AS grp_size
  FROM public.crm_contacts
  WHERE phone IS NOT NULL
    AND email IS NOT NULL
    AND btrim(email) <> ''
    AND LENGTH(REGEXP_REPLACE(phone,'[^0-9]','','g')) >= 9
    AND coalesce(is_archived, false) = false
    AND merged_into_contact_id IS NULL
)
UPDATE public.crm_contacts c
SET is_archived = true,
    updated_at = now()
FROM grp
WHERE c.id = grp.id
  AND grp.rn > 1
  AND grp.grp_size > 1;