CREATE INDEX IF NOT EXISTS idx_crm_contacts_email_lower ON public.crm_contacts (lower(trim(email)));
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone9 ON public.crm_contacts (right(regexp_replace(coalesce(phone,''),'\D','','g'),9));
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact_id ON public.crm_deals (contact_id);