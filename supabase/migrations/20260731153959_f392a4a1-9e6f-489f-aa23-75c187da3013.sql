ALTER TABLE public.ar_titulos
  ADD COLUMN IF NOT EXISTS cobranca_responsavel_id uuid,
  ADD COLUMN IF NOT EXISTS cobranca_ultima_data date,
  ADD COLUMN IF NOT EXISTS cobranca_ultima_nota text,
  ADD COLUMN IF NOT EXISTS cobranca_ultimo_registro_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_ar_titulos_cobranca_responsavel
  ON public.ar_titulos (cobranca_responsavel_id);