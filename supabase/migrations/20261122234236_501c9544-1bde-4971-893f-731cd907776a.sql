SET LOCAL lock_timeout = '3s';
CREATE INDEX IF NOT EXISTS idx_sdr_email_lower ON public.sdr (lower(email));