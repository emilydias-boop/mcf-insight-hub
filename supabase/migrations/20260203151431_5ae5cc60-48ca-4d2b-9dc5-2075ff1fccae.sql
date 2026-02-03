-- =============================================
-- FECHAMENTO CONSÓRCIO - CLOSERS
-- =============================================

-- Tabela: consorcio_closer_payout
-- Fechamento mensal dos Closers do Consórcio
CREATE TABLE public.consorcio_closer_payout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id UUID REFERENCES public.closers(id) NOT NULL,
  ano_mes TEXT NOT NULL, -- '2026-02'
  
  -- OTE Base (do cargo_catalogo ou plano específico)
  ote_total NUMERIC DEFAULT 5000,
  fixo_valor NUMERIC DEFAULT 3500,    -- 70%
  variavel_total NUMERIC DEFAULT 1500, -- 30%
  
  -- KPIs do mês
  comissao_consorcio NUMERIC DEFAULT 0,      -- Valor em R$
  comissao_holding NUMERIC DEFAULT 0,        -- Valor em R$
  score_organizacao NUMERIC DEFAULT 100,     -- 0-100
  
  -- Metas (para calcular %)
  meta_comissao_consorcio NUMERIC DEFAULT 2000,
  meta_comissao_holding NUMERIC DEFAULT 500,
  meta_organizacao NUMERIC DEFAULT 100,
  
  -- Performance %
  pct_comissao_consorcio NUMERIC,
  pct_comissao_holding NUMERIC,
  pct_organizacao NUMERIC,
  
  -- Multiplicadores
  mult_comissao_consorcio NUMERIC,
  mult_comissao_holding NUMERIC,
  mult_organizacao NUMERIC,
  
  -- Valores finais por métrica (peso × mult × base)
  valor_comissao_consorcio NUMERIC,  -- 72% do variável
  valor_comissao_holding NUMERIC,    -- 18% do variável
  valor_organizacao NUMERIC,         -- 10% do variável
  
  -- Totais
  valor_variavel_final NUMERIC,
  total_conta NUMERIC,
  
  -- Bônus
  bonus_extra NUMERIC DEFAULT 0,
  bonus_autorizado BOOLEAN DEFAULT false,
  
  -- Status e aprovação
  status TEXT DEFAULT 'DRAFT', -- DRAFT, APPROVED, LOCKED
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMPTZ,
  ajustes_json JSONB DEFAULT '[]',
  
  -- Auditoria
  dias_uteis_mes INTEGER DEFAULT 19,
  nfse_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(closer_id, ano_mes)
);

-- Tabela: consorcio_venda_holding
-- Para registrar vendas de holding atribuídas aos closers
CREATE TABLE public.consorcio_venda_holding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id UUID REFERENCES public.closers(id) NOT NULL,
  ano_mes TEXT NOT NULL,
  descricao TEXT,
  valor_venda NUMERIC NOT NULL,
  valor_comissao NUMERIC NOT NULL,
  data_venda DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_consorcio_closer_payout_closer_id ON public.consorcio_closer_payout(closer_id);
CREATE INDEX idx_consorcio_closer_payout_ano_mes ON public.consorcio_closer_payout(ano_mes);
CREATE INDEX idx_consorcio_closer_payout_status ON public.consorcio_closer_payout(status);
CREATE INDEX idx_consorcio_venda_holding_closer_id ON public.consorcio_venda_holding(closer_id);
CREATE INDEX idx_consorcio_venda_holding_ano_mes ON public.consorcio_venda_holding(ano_mes);

-- Enable RLS
ALTER TABLE public.consorcio_closer_payout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consorcio_venda_holding ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consorcio_closer_payout
CREATE POLICY "Allow authenticated users to read consorcio_closer_payout"
ON public.consorcio_closer_payout FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert consorcio_closer_payout"
ON public.consorcio_closer_payout FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update consorcio_closer_payout"
ON public.consorcio_closer_payout FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to delete consorcio_closer_payout"
ON public.consorcio_closer_payout FOR DELETE
TO authenticated
USING (true);

-- RLS Policies for consorcio_venda_holding
CREATE POLICY "Allow authenticated users to read consorcio_venda_holding"
ON public.consorcio_venda_holding FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert consorcio_venda_holding"
ON public.consorcio_venda_holding FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update consorcio_venda_holding"
ON public.consorcio_venda_holding FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to delete consorcio_venda_holding"
ON public.consorcio_venda_holding FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_consorcio_closer_payout_updated_at
  BEFORE UPDATE ON public.consorcio_closer_payout
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();