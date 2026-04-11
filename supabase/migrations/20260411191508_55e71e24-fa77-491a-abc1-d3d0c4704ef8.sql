
-- Create enum for post-sale status
CREATE TYPE public.contract_pos_venda_status AS ENUM (
  'desistiu_antes_r2',
  'nao_responde',
  'tentando_agendar',
  'agendado',
  'r2_realizada',
  'no_show',
  'desistiu_apos_r2',
  'aprovado'
);

-- Create tracking table
CREATE TABLE public.contract_post_sale_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.hubla_transactions(id) ON DELETE CASCADE,
  status_pos_venda public.contract_pos_venda_status NOT NULL,
  sub_status TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_transaction UNIQUE (transaction_id)
);

-- Enable RLS
ALTER TABLE public.contract_post_sale_tracking ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view post-sale tracking"
  ON public.contract_post_sale_tracking FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert post-sale tracking"
  ON public.contract_post_sale_tracking FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update post-sale tracking"
  ON public.contract_post_sale_tracking FOR UPDATE
  TO authenticated USING (true);

-- Index for performance
CREATE INDEX idx_post_sale_tracking_status ON public.contract_post_sale_tracking(status_pos_venda);
CREATE INDEX idx_post_sale_tracking_transaction ON public.contract_post_sale_tracking(transaction_id);

-- Auto-update updated_at
CREATE TRIGGER update_post_sale_tracking_updated_at
  BEFORE UPDATE ON public.contract_post_sale_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
