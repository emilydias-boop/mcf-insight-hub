-- Atualizar owner_id e owner_profile_id baseado no user_email dos custom_fields
UPDATE crm_deals d
SET 
  owner_id = d.custom_fields->>'user_email',
  owner_profile_id = p.id
FROM profiles p
WHERE d.origin_id = '4e2b810a-6782-4ce9-9c0d-10d04c018636'
  AND d.owner_profile_id IS NULL
  AND d.custom_fields->>'user_email' = p.email;