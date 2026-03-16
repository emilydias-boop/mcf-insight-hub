
-- Enums for billing system
CREATE TYPE public.billing_subscription_status AS ENUM ('em_dia', 'atrasada', 'cancelada', 'finalizada', 'quitada');
CREATE TYPE public.billing_quitacao_status AS ENUM ('em_aberto', 'parcialmente_pago', 'quitado');
CREATE TYPE public.billing_installment_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TYPE public.billing_agreement_status AS ENUM ('em_aberto', 'em_andamento', 'cumprido', 'quebrado');
CREATE TYPE public.billing_history_type AS ENUM ('entrada_paga', 'parcela_paga', 'parcela_atrasada', 'boleto_gerado', 'tentativa_cobranca', 'acordo_realizado', 'cancelamento', 'quitacao', 'observacao');
CREATE TYPE public.billing_payment_method AS ENUM ('pix', 'credit_card', 'bank_slip', 'boleto', 'outro');

-- 1. billing_subscriptions
CREATE TABLE public.billing_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_category TEXT,
  valor_entrada NUMERIC(12,2) DEFAULT 0,
  valor_total_contrato NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_parcelas INTEGER NOT NULL DEFAULT 1,
  forma_pagamento public.billing_payment_method DEFAULT 'boleto',
  status public.billing_subscription_status NOT NULL DEFAULT 'em_dia',
  status_quitacao public.billing_quitacao_status NOT NULL DEFAULT 'em_aberto',
  data_inicio DATE,
  data_fim_prevista DATE,
  responsavel_financeiro TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and financeiro can manage billing_subscriptions"
  ON public.billing_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

-- 2. billing_installments
CREATE TABLE public.billing_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor_original NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_pago NUMERIC(12,2) DEFAULT 0,
  valor_liquido NUMERIC(12,2) DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  forma_pagamento public.billing_payment_method,
  status public.billing_installment_status NOT NULL DEFAULT 'pendente',
  hubla_transaction_id UUID,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and financeiro can manage billing_installments"
  ON public.billing_installments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

-- 3. billing_agreements
CREATE TABLE public.billing_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  responsavel TEXT NOT NULL,
  data_negociacao DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo_negociacao TEXT,
  valor_original_divida NUMERIC(12,2) NOT NULL DEFAULT 0,
  novo_valor_negociado NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantidade_parcelas INTEGER NOT NULL DEFAULT 1,
  forma_pagamento public.billing_payment_method DEFAULT 'boleto',
  data_primeiro_vencimento DATE,
  status public.billing_agreement_status NOT NULL DEFAULT 'em_aberto',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.billing_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and financeiro can manage billing_agreements"
  ON public.billing_agreements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

-- 4. billing_agreement_installments
CREATE TABLE public.billing_agreement_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_id UUID NOT NULL REFERENCES public.billing_agreements(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status public.billing_installment_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_agreement_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and financeiro can manage billing_agreement_installments"
  ON public.billing_agreement_installments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

-- 5. billing_history
CREATE TABLE public.billing_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  tipo public.billing_history_type NOT NULL,
  valor NUMERIC(12,2),
  forma_pagamento public.billing_payment_method,
  status TEXT,
  responsavel TEXT,
  descricao TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and financeiro can manage billing_history"
  ON public.billing_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

-- Indexes
CREATE INDEX idx_billing_subscriptions_email ON public.billing_subscriptions(customer_email);
CREATE INDEX idx_billing_subscriptions_status ON public.billing_subscriptions(status);
CREATE INDEX idx_billing_subscriptions_deal ON public.billing_subscriptions(deal_id);
CREATE INDEX idx_billing_installments_sub ON public.billing_installments(subscription_id);
CREATE INDEX idx_billing_installments_status ON public.billing_installments(status);
CREATE INDEX idx_billing_installments_vencimento ON public.billing_installments(data_vencimento);
CREATE INDEX idx_billing_agreements_sub ON public.billing_agreements(subscription_id);
CREATE INDEX idx_billing_agreement_inst_agr ON public.billing_agreement_installments(agreement_id);
CREATE INDEX idx_billing_history_sub ON public.billing_history(subscription_id);

-- Trigger for updated_at on billing_subscriptions
CREATE OR REPLACE FUNCTION public.update_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_billing_updated_at();

CREATE TRIGGER update_billing_installments_updated_at
  BEFORE UPDATE ON public.billing_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_billing_updated_at();

CREATE TRIGGER update_billing_agreements_updated_at
  BEFORE UPDATE ON public.billing_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_billing_updated_at();

CREATE TRIGGER update_billing_agreement_installments_updated_at
  BEFORE UPDATE ON public.billing_agreement_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_billing_updated_at();
