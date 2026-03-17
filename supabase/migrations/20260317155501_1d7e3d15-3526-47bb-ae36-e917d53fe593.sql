
-- Tabela dedicada para dados completos do lead (visão 360°)
CREATE TABLE public.lead_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,

  -- Pessoal
  nome_completo TEXT,
  cpf TEXT,
  whatsapp TEXT,
  data_nascimento DATE,
  estado_cidade TEXT,
  estado_civil TEXT,
  num_filhos INTEGER,

  -- Profissional
  profissao TEXT,
  is_empresario BOOLEAN DEFAULT FALSE,
  porte_empresa INTEGER,

  -- Financeiro
  renda_bruta NUMERIC(14,2),
  fonte_renda TEXT,
  faixa_aporte NUMERIC(14,2),
  faixa_aporte_descricao TEXT,

  -- Perfil / Interesses
  esporte_hobby TEXT,
  gosta_futebol BOOLEAN DEFAULT FALSE,
  time_futebol TEXT,

  -- Empresa / Capital
  precisa_capital_giro BOOLEAN DEFAULT FALSE,
  valor_capital_giro NUMERIC(14,2),

  -- Objetivos
  objetivos_principais JSONB DEFAULT '[]'::jsonb,
  renda_passiva_meta NUMERIC(14,2),
  tempo_independencia TEXT,

  -- Patrimônio
  imovel_financiado BOOLEAN DEFAULT FALSE,
  possui_consorcio BOOLEAN DEFAULT FALSE,
  saldo_fgts NUMERIC(14,2),

  -- Investimentos
  investe BOOLEAN DEFAULT FALSE,
  valor_investido NUMERIC(14,2),
  corretora TEXT,

  -- Situação financeira
  possui_divida BOOLEAN DEFAULT FALSE,

  -- Outros
  possui_seguros BOOLEAN DEFAULT FALSE,
  possui_carro BOOLEAN DEFAULT FALSE,

  -- Relacionamento bancário
  bancos JSONB DEFAULT '[]'::jsonb,

  -- Perfil avançado
  interesse_holding BOOLEAN DEFAULT FALSE,
  perfil_indicacao TEXT,

  -- Campos calculados
  lead_score INTEGER DEFAULT 0,
  icp_level TEXT,

  -- Controle
  data_cadastro TIMESTAMPTZ DEFAULT NOW(),
  origem TEXT DEFAULT 'mcf_crm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_lead_profiles_cpf ON public.lead_profiles (cpf) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX idx_lead_profiles_contact ON public.lead_profiles (contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_lead_profiles_whatsapp ON public.lead_profiles (whatsapp);
CREATE INDEX idx_lead_profiles_deal ON public.lead_profiles (deal_id);
CREATE INDEX idx_lead_profiles_lead_score ON public.lead_profiles (lead_score DESC);

-- RLS
ALTER TABLE public.lead_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lead_profiles"
  ON public.lead_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert lead_profiles"
  ON public.lead_profiles FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update lead_profiles"
  ON public.lead_profiles FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Service role full access lead_profiles"
  ON public.lead_profiles FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_lead_profiles_updated_at
  BEFORE UPDATE ON public.lead_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fechamento_metricas_updated_at();
