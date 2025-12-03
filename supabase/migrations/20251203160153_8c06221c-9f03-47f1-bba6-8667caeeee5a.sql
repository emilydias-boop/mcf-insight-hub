-- 1. Criar tabela de níveis SDR
CREATE TABLE IF NOT EXISTS public.sdr_levels (
  level INTEGER PRIMARY KEY,
  fixo_valor NUMERIC NOT NULL,
  description TEXT
);

-- Inserir níveis
INSERT INTO public.sdr_levels (level, fixo_valor, description) VALUES
(1, 2800, 'Nível 1'),
(2, 3150, 'Nível 2'),
(3, 3500, 'Nível 3'),
(4, 3850, 'Nível 4'),
(5, 4200, 'Nível 5'),
(6, 4550, 'Nível 6'),
(7, 4900, 'Nível 7')
ON CONFLICT (level) DO NOTHING;

-- 2. Adicionar campos na tabela sdr
ALTER TABLE public.sdr 
ADD COLUMN IF NOT EXISTS nivel INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS meta_diaria INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS observacao TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS criado_por UUID,
ADD COLUMN IF NOT EXISTS aprovado_por UUID,
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

-- 3. Adicionar campos na tabela sdr_comp_plan
ALTER TABLE public.sdr_comp_plan
ADD COLUMN IF NOT EXISTS dias_uteis INTEGER DEFAULT 22,
ADD COLUMN IF NOT EXISTS meta_no_show_pct NUMERIC DEFAULT 30;

-- 4. Adicionar campos na tabela sdr_month_kpi
ALTER TABLE public.sdr_month_kpi
ADD COLUMN IF NOT EXISTS no_shows INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS intermediacoes_contrato INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS taxa_no_show NUMERIC;

-- 5. Adicionar campo ifood_ultrameta_autorizado na tabela sdr_month_payout
ALTER TABLE public.sdr_month_payout
ADD COLUMN IF NOT EXISTS ifood_ultrameta_autorizado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ifood_ultrameta_autorizado_por UUID,
ADD COLUMN IF NOT EXISTS ifood_ultrameta_autorizado_em TIMESTAMPTZ;

-- 6. Criar tabela de intermediações
CREATE TABLE IF NOT EXISTS public.sdr_intermediacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sdr_id UUID NOT NULL REFERENCES public.sdr(id) ON DELETE CASCADE,
  ano_mes TEXT NOT NULL,
  hubla_transaction_id UUID REFERENCES public.hubla_transactions(id),
  produto_nome TEXT,
  valor_venda NUMERIC,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- 7. Habilitar RLS na tabela sdr_levels
ALTER TABLE public.sdr_levels ENABLE ROW LEVEL SECURITY;

-- RLS para sdr_levels (todos podem ver)
CREATE POLICY "Todos podem visualizar níveis SDR"
ON public.sdr_levels FOR SELECT
USING (true);

-- 8. Habilitar RLS na tabela sdr_intermediacoes
ALTER TABLE public.sdr_intermediacoes ENABLE ROW LEVEL SECURITY;

-- RLS para sdr_intermediacoes
CREATE POLICY "Admins e coordenadores podem ver todas intermediações"
ON public.sdr_intermediacoes FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

CREATE POLICY "SDRs podem ver suas próprias intermediações"
ON public.sdr_intermediacoes FOR SELECT
USING (is_own_sdr(sdr_id));

CREATE POLICY "Admins e coordenadores podem gerenciar intermediações"
ON public.sdr_intermediacoes FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

-- 9. Criar índices
CREATE INDEX IF NOT EXISTS idx_sdr_intermediacoes_sdr_id ON public.sdr_intermediacoes(sdr_id);
CREATE INDEX IF NOT EXISTS idx_sdr_intermediacoes_ano_mes ON public.sdr_intermediacoes(ano_mes);
CREATE INDEX IF NOT EXISTS idx_sdr_nivel ON public.sdr(nivel);