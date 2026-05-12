
ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS lead_temperature text
  CHECK (lead_temperature IS NULL OR lead_temperature IN ('quente','morno','frio'));

CREATE INDEX IF NOT EXISTS idx_crm_deals_lead_temperature
  ON public.crm_deals(lead_temperature)
  WHERE lead_temperature IS NOT NULL;
