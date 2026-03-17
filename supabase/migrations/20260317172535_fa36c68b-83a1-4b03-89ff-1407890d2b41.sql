DROP INDEX IF EXISTS idx_lead_profiles_contact;
ALTER TABLE lead_profiles ADD CONSTRAINT lead_profiles_contact_id_unique UNIQUE (contact_id);