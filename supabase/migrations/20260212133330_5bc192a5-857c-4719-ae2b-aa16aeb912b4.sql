
-- Tabela para registrar retornos de parceiros bloqueados
CREATE TABLE public.partner_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  contact_email TEXT,
  contact_name TEXT,
  partner_product TEXT NOT NULL,
  return_source TEXT NOT NULL,
  return_product TEXT,
  return_value NUMERIC DEFAULT 0,
  original_deal_id UUID,
  blocked BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_returns ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can read partner_returns"
  ON public.partner_returns
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role (webhooks) can insert
CREATE POLICY "Service role can insert partner_returns"
  ON public.partner_returns
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Authenticated users can update (mark as reviewed)
CREATE POLICY "Authenticated users can update partner_returns"
  ON public.partner_returns
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX idx_partner_returns_email ON public.partner_returns (contact_email);
CREATE INDEX idx_partner_returns_created_at ON public.partner_returns (created_at DESC);
