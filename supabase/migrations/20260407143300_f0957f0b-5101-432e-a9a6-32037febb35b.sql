
-- Create enum for action types
CREATE TYPE public.cobranca_acao_tipo AS ENUM ('boleto_enviado', 'lead_respondeu', 'sem_retorno', 'pago_confirmado');

-- Create table for tracking operator actions on installments
CREATE TABLE public.cobranca_acoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installment_id UUID REFERENCES public.consortium_installments(id) ON DELETE CASCADE,
  billing_installment_id UUID REFERENCES public.billing_installments(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  tipo_acao public.cobranca_acao_tipo NOT NULL,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add constraint: at least one reference must be set
ALTER TABLE public.cobranca_acoes ADD CONSTRAINT chk_at_least_one_ref
  CHECK (installment_id IS NOT NULL OR billing_installment_id IS NOT NULL OR subscription_id IS NOT NULL);

-- Indexes for fast lookups
CREATE INDEX idx_cobranca_acoes_installment ON public.cobranca_acoes(installment_id) WHERE installment_id IS NOT NULL;
CREATE INDEX idx_cobranca_acoes_billing_inst ON public.cobranca_acoes(billing_installment_id) WHERE billing_installment_id IS NOT NULL;
CREATE INDEX idx_cobranca_acoes_subscription ON public.cobranca_acoes(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX idx_cobranca_acoes_created_at ON public.cobranca_acoes(created_at DESC);

-- Enable RLS
ALTER TABLE public.cobranca_acoes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all actions
CREATE POLICY "Authenticated users can view cobranca_acoes"
ON public.cobranca_acoes
FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can insert actions
CREATE POLICY "Authenticated users can insert cobranca_acoes"
ON public.cobranca_acoes
FOR INSERT
TO authenticated
WITH CHECK (true);
