UPDATE public.crm_deals
SET contact_id = '30cf8e48-bfde-4df9-b96d-f72aecbcc154',
    updated_at = now()
WHERE id = '6d10ccb6-851f-49e4-97b8-6aa8ba1d88cd'
  AND contact_id IS NULL;