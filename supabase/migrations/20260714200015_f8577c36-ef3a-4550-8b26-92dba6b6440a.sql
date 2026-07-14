
ALTER TABLE public.ar_titulos
  ADD COLUMN IF NOT EXISTS cobranca_stage text CHECK (cobranca_stage IN ('mes','atraso','judicial')),
  ADD COLUMN IF NOT EXISTS cobranca_stage_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cobranca_stage_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ar_titulos_cobranca_stage
  ON public.ar_titulos(cobranca_stage) WHERE status = 'aberto';

CREATE OR REPLACE FUNCTION public.compute_cobranca_stage(_titulo_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.ar_parcelas p
      WHERE p.titulo_id = _titulo_id
        AND p.status IN ('pendente','atrasado')
        AND p.data_vencimento < CURRENT_DATE
    ) THEN 'atraso'
    WHEN EXISTS (
      SELECT 1 FROM public.ar_parcelas p
      WHERE p.titulo_id = _titulo_id
        AND p.status IN ('pendente','atrasado')
        AND date_trunc('month', p.data_vencimento) = date_trunc('month', CURRENT_DATE)
    ) THEN 'mes'
    ELSE 'mes'
  END;
$$;
