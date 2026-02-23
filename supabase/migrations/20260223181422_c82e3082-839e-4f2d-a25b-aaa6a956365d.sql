
-- Create pending registrations table
CREATE TABLE public.consorcio_pending_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES public.consorcio_proposals(id),
  deal_id UUID REFERENCES public.crm_deals(id),
  status TEXT NOT NULL DEFAULT 'aguardando_abertura' CHECK (status IN ('aguardando_abertura', 'cota_aberta')),
  tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('pf', 'pj')),

  -- PF fields (closer)
  nome_completo TEXT,
  rg TEXT,
  cpf TEXT,
  cpf_conjuge TEXT,
  profissao TEXT,
  telefone TEXT,
  email TEXT,
  endereco_completo TEXT,
  endereco_cep TEXT,
  renda NUMERIC,
  patrimonio NUMERIC,
  pix TEXT,

  -- PJ fields (closer)
  razao_social TEXT,
  cnpj TEXT,
  natureza_juridica TEXT,
  inscricao_estadual TEXT,
  data_fundacao DATE,
  telefone_comercial TEXT,
  email_comercial TEXT,
  endereco_comercial TEXT,
  endereco_comercial_cep TEXT,
  num_funcionarios INTEGER,
  faturamento_mensal NUMERIC,
  socios JSONB DEFAULT '[]'::jsonb,

  -- Metadata (closer)
  vendedor_name TEXT,
  aceite_date DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Cota fields (gestor)
  categoria TEXT,
  grupo TEXT,
  cota TEXT,
  valor_credito NUMERIC,
  prazo_meses INTEGER,
  tipo_produto TEXT,
  produto_codigo TEXT,
  condicao_pagamento TEXT,
  inclui_seguro BOOLEAN DEFAULT false,
  empresa_paga_parcelas TEXT,
  tipo_contrato TEXT,
  parcelas_pagas_empresa INTEGER,
  dia_vencimento INTEGER,
  inicio_segunda_parcela TEXT,
  data_contratacao DATE,
  origem TEXT,
  origem_detalhe TEXT,
  vendedor_id UUID,
  vendedor_name_cota TEXT,
  valor_comissao NUMERIC,
  e_transferencia BOOLEAN DEFAULT false,
  transferido_de TEXT,
  observacoes TEXT,
  consortium_card_id UUID
);

-- Add pending_registration_id to consortium_documents
ALTER TABLE public.consortium_documents
  ADD COLUMN pending_registration_id UUID REFERENCES public.consorcio_pending_registrations(id);

-- Make card_id nullable so documents can be linked to pending registrations
ALTER TABLE public.consortium_documents ALTER COLUMN card_id DROP NOT NULL;

-- Enable RLS
ALTER TABLE public.consorcio_pending_registrations ENABLE ROW LEVEL SECURITY;

-- Policies using user_roles table
CREATE POLICY "Users can insert pending registrations"
  ON public.consorcio_pending_registrations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view pending registrations"
  ON public.consorcio_pending_registrations FOR SELECT
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'coordenador')
    )
  );

CREATE POLICY "Managers can update pending registrations"
  ON public.consorcio_pending_registrations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'coordenador')
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_consorcio_pending_registrations_updated_at
  BEFORE UPDATE ON public.consorcio_pending_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fechamento_metricas_updated_at();
