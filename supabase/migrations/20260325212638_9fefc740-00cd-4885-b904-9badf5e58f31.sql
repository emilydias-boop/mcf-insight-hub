ALTER TABLE webhook_endpoints 
  ADD COLUMN fixed_owner_email text,
  ADD COLUMN fixed_owner_profile_id uuid;