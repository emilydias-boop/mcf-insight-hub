CREATE INDEX IF NOT EXISTS idx_crm_contacts_name_trgm ON public.crm_contacts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email_trgm ON public.crm_contacts USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone_trgm ON public.crm_contacts USING gin (phone gin_trgm_ops);