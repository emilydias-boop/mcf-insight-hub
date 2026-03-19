
-- Add new payment method enum values
ALTER TYPE billing_payment_method ADD VALUE IF NOT EXISTS 'boleto_parcelado';
ALTER TYPE billing_payment_method ADD VALUE IF NOT EXISTS 'cartao_parcelado';
ALTER TYPE billing_payment_method ADD VALUE IF NOT EXISTS 'pix_parcelado';

-- Create billing_payment_receivables table
CREATE TABLE public.billing_payment_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES public.billing_installments(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  valor DECIMAL NOT NULL DEFAULT 0,
  data_prevista DATE NOT NULL,
  data_recebimento DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'recebido')),
  forma_pagamento billing_payment_method,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_payment_receivables ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as billing_installments - allow all for authenticated)
CREATE POLICY "Authenticated users can view receivables"
  ON public.billing_payment_receivables FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert receivables"
  ON public.billing_payment_receivables FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update receivables"
  ON public.billing_payment_receivables FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete receivables"
  ON public.billing_payment_receivables FOR DELETE TO authenticated USING (true);

-- Index for fast lookups
CREATE INDEX idx_receivables_installment_id ON public.billing_payment_receivables(installment_id);

-- Trigger for updated_at
CREATE TRIGGER update_receivables_updated_at
  BEFORE UPDATE ON public.billing_payment_receivables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_automation_updated_at();
