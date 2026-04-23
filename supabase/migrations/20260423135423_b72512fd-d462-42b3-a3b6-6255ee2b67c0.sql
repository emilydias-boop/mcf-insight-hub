-- Add merge audit columns to crm_deals
ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS merged_into_deal_id uuid REFERENCES public.crm_deals(id),
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Partial index for active deals lookups (Kanban etc.)
CREATE INDEX IF NOT EXISTS idx_crm_deals_active_contact_origin
  ON public.crm_deals(contact_id, origin_id)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_crm_deals_active
  ON public.crm_deals(id)
  WHERE is_archived = false;