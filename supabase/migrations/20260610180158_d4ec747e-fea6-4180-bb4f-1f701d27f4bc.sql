-- Add per-installment cobranca workflow status
ALTER TABLE public.consortium_installments
  ADD COLUMN IF NOT EXISTS cobranca_status TEXT
    CHECK (cobranca_status IN ('cobrada','aguardando_retorno','sem_resposta','cancelada')),
  ADD COLUMN IF NOT EXISTS cobranca_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cobranca_status_updated_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_consortium_installments_cobranca_status
  ON public.consortium_installments(cobranca_status)
  WHERE cobranca_status IS NOT NULL;