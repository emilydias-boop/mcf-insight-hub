ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS last_auto_dialer_call_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_crm_deals_last_auto_dialer_call_at
  ON public.crm_deals (last_auto_dialer_call_at)
  WHERE last_auto_dialer_call_at IS NOT NULL;