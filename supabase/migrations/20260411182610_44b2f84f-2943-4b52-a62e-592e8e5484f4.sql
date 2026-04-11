
-- Add new enum values to billing_installment_status
ALTER TYPE public.billing_installment_status ADD VALUE IF NOT EXISTS 'reembolso';
ALTER TYPE public.billing_installment_status ADD VALUE IF NOT EXISTS 'nao_sera_pago';

-- Add exclusao_motivo field to billing_installments
ALTER TABLE public.billing_installments
ADD COLUMN IF NOT EXISTS exclusao_motivo text;

-- Add link_assinatura_enviado field to billing_subscriptions
ALTER TABLE public.billing_subscriptions
ADD COLUMN IF NOT EXISTS link_assinatura_enviado boolean DEFAULT false;
