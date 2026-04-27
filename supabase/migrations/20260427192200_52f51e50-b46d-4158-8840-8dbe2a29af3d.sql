UPDATE public.crm_contacts
SET is_archived = true,
    updated_at = now()
WHERE COALESCE(is_archived, false) = false
  AND (name = 'Contato sem nome' OR name IS NULL OR btrim(name) = '')
  AND (email IS NULL OR btrim(email) = '')
  AND (phone IS NULL OR btrim(phone) = '');