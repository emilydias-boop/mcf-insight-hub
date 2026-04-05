
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS merged_into_contact_id UUID REFERENCES public.crm_contacts(id),
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_merged_into ON public.crm_contacts(merged_into_contact_id) WHERE merged_into_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_is_archived ON public.crm_contacts(is_archived) WHERE is_archived = true;
