-- Tabela principal de cartas de consórcio
CREATE TABLE public.consortium_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Tipo de pessoa
  tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('pf', 'pj')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'cancelado', 'contemplado')),
  
  -- Dados da cota
  grupo TEXT NOT NULL,
  cota TEXT NOT NULL,
  valor_credito NUMERIC NOT NULL,
  prazo_meses INTEGER NOT NULL,
  tipo_produto TEXT NOT NULL CHECK (tipo_produto IN ('select', 'parcelinha')),
  tipo_contrato TEXT NOT NULL DEFAULT 'normal' CHECK (tipo_contrato IN ('normal', 'intercalado')),
  parcelas_pagas_empresa INTEGER NOT NULL DEFAULT 0,
  data_contratacao DATE NOT NULL,
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  
  -- Origem
  origem TEXT NOT NULL CHECK (origem IN ('socio', 'gr', 'indicacao', 'outros')),
  origem_detalhe TEXT,
  
  -- Responsável
  vendedor_id UUID REFERENCES public.employees(id),
  vendedor_name TEXT,
  
  -- Dados PF
  nome_completo TEXT,
  data_nascimento DATE,
  cpf TEXT,
  rg TEXT,
  estado_civil TEXT CHECK (estado_civil IN ('solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel')),
  cpf_conjuge TEXT,
  endereco_cep TEXT,
  endereco_rua TEXT,
  endereco_numero TEXT,
  endereco_complemento TEXT,
  endereco_bairro TEXT,
  endereco_cidade TEXT,
  endereco_estado TEXT,
  telefone TEXT,
  email TEXT,
  profissao TEXT,
  tipo_servidor TEXT CHECK (tipo_servidor IN ('estadual', 'federal', 'municipal')),
  renda NUMERIC,
  patrimonio NUMERIC,
  pix TEXT,
  
  -- Dados PJ
  razao_social TEXT,
  cnpj TEXT,
  natureza_juridica TEXT,
  inscricao_estadual TEXT,
  data_fundacao DATE,
  endereco_comercial_cep TEXT,
  endereco_comercial_rua TEXT,
  endereco_comercial_numero TEXT,
  endereco_comercial_complemento TEXT,
  endereco_comercial_bairro TEXT,
  endereco_comercial_cidade TEXT,
  endereco_comercial_estado TEXT,
  telefone_comercial TEXT,
  email_comercial TEXT,
  faturamento_mensal NUMERIC,
  num_funcionarios INTEGER
);

-- Tabela de sócios PJ
CREATE TABLE public.consortium_pj_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.consortium_cards(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  renda NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de documentos
CREATE TABLE public.consortium_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.consortium_cards(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('cnh', 'rg', 'contrato_social', 'cartao_cnpj', 'comprovante_residencia', 'outro')),
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT,
  storage_url TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID
);

-- Tabela de parcelas
CREATE TABLE public.consortium_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.consortium_cards(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('cliente', 'empresa')),
  valor_parcela NUMERIC NOT NULL,
  valor_comissao NUMERIC NOT NULL DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(card_id, numero_parcela)
);

-- Habilitar RLS
ALTER TABLE public.consortium_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_pj_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_installments ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (leitura para todos autenticados)
CREATE POLICY "Authenticated users can view consortium_cards"
ON public.consortium_cards FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert consortium_cards"
ON public.consortium_cards FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update consortium_cards"
ON public.consortium_cards FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete consortium_cards"
ON public.consortium_cards FOR DELETE
USING (auth.role() = 'authenticated');

-- Políticas para sócios PJ
CREATE POLICY "Authenticated users can view consortium_pj_partners"
ON public.consortium_pj_partners FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert consortium_pj_partners"
ON public.consortium_pj_partners FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update consortium_pj_partners"
ON public.consortium_pj_partners FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete consortium_pj_partners"
ON public.consortium_pj_partners FOR DELETE
USING (auth.role() = 'authenticated');

-- Políticas para documentos
CREATE POLICY "Authenticated users can view consortium_documents"
ON public.consortium_documents FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert consortium_documents"
ON public.consortium_documents FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update consortium_documents"
ON public.consortium_documents FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete consortium_documents"
ON public.consortium_documents FOR DELETE
USING (auth.role() = 'authenticated');

-- Políticas para parcelas
CREATE POLICY "Authenticated users can view consortium_installments"
ON public.consortium_installments FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert consortium_installments"
ON public.consortium_installments FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update consortium_installments"
ON public.consortium_installments FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete consortium_installments"
ON public.consortium_installments FOR DELETE
USING (auth.role() = 'authenticated');

-- Índices para performance
CREATE INDEX idx_consortium_cards_vendedor ON public.consortium_cards(vendedor_id);
CREATE INDEX idx_consortium_cards_status ON public.consortium_cards(status);
CREATE INDEX idx_consortium_cards_data_contratacao ON public.consortium_cards(data_contratacao);
CREATE INDEX idx_consortium_installments_card ON public.consortium_installments(card_id);
CREATE INDEX idx_consortium_installments_status ON public.consortium_installments(status);
CREATE INDEX idx_consortium_documents_card ON public.consortium_documents(card_id);

-- Trigger para updated_at
CREATE TRIGGER update_consortium_cards_updated_at
BEFORE UPDATE ON public.consortium_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_consortium_installments_updated_at
BEFORE UPDATE ON public.consortium_installments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();