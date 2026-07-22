ALTER TABLE public.consorcio_pending_registrations
  ADD COLUMN IF NOT EXISTS motivo_declinio TEXT,
  ADD COLUMN IF NOT EXISTS declinada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declinada_by UUID;

CREATE INDEX IF NOT EXISTS idx_consorcio_pending_registrations_status
  ON public.consorcio_pending_registrations(status);