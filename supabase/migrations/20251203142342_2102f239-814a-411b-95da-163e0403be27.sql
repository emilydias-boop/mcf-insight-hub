-- Tabela SDR - Cadastro de SDRs
CREATE TABLE public.sdr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela sdr_comp_plan - Plano de OTE de cada SDR
CREATE TABLE public.sdr_comp_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sdr_id UUID REFERENCES public.sdr(id) ON DELETE CASCADE NOT NULL,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,
  ote_total NUMERIC NOT NULL DEFAULT 4000,
  fixo_valor NUMERIC NOT NULL DEFAULT 2800,
  variavel_total NUMERIC NOT NULL DEFAULT 1200,
  valor_meta_rpg NUMERIC NOT NULL DEFAULT 300,
  valor_docs_reuniao NUMERIC NOT NULL DEFAULT 600,
  valor_tentativas NUMERIC NOT NULL DEFAULT 0,
  valor_organizacao NUMERIC NOT NULL DEFAULT 300,
  ifood_mensal NUMERIC DEFAULT 630,
  ifood_ultrameta NUMERIC DEFAULT 840,
  meta_reunioes_agendadas INTEGER DEFAULT 115,
  meta_reunioes_realizadas INTEGER DEFAULT 48,
  meta_tentativas INTEGER DEFAULT 1932,
  meta_organizacao NUMERIC DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela sdr_month_kpi - KPIs consolidados por SDR/mês
CREATE TABLE public.sdr_month_kpi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sdr_id UUID REFERENCES public.sdr(id) ON DELETE CASCADE NOT NULL,
  ano_mes TEXT NOT NULL,
  reunioes_agendadas INTEGER DEFAULT 0,
  reunioes_realizadas INTEGER DEFAULT 0,
  tentativas_ligacoes INTEGER DEFAULT 0,
  score_organizacao NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sdr_id, ano_mes)
);

-- Tabela sdr_month_payout - Resultado do fechamento
CREATE TABLE public.sdr_month_payout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sdr_id UUID REFERENCES public.sdr(id) ON DELETE CASCADE NOT NULL,
  ano_mes TEXT NOT NULL,
  pct_reunioes_agendadas NUMERIC,
  pct_reunioes_realizadas NUMERIC,
  pct_tentativas NUMERIC,
  pct_organizacao NUMERIC,
  mult_reunioes_agendadas NUMERIC,
  mult_reunioes_realizadas NUMERIC,
  mult_tentativas NUMERIC,
  mult_organizacao NUMERIC,
  valor_reunioes_agendadas NUMERIC,
  valor_reunioes_realizadas NUMERIC,
  valor_tentativas NUMERIC,
  valor_organizacao NUMERIC,
  valor_variavel_total NUMERIC,
  valor_fixo NUMERIC,
  total_conta NUMERIC,
  ifood_mensal NUMERIC,
  ifood_ultrameta NUMERIC,
  total_ifood NUMERIC,
  status TEXT DEFAULT 'DRAFT',
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMPTZ,
  ajustes_json JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sdr_id, ano_mes)
);

-- Tabela sdr_payout_audit_log - Log de alterações
CREATE TABLE public.sdr_payout_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID REFERENCES public.sdr_month_payout(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.sdr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_comp_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_month_kpi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_month_payout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_payout_audit_log ENABLE ROW LEVEL SECURITY;

-- Função helper para verificar se é SDR do próprio usuário
CREATE OR REPLACE FUNCTION public.is_own_sdr(_sdr_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sdr
    WHERE id = _sdr_id AND user_id = auth.uid()
  )
$$;

-- Políticas RLS para tabela sdr
CREATE POLICY "Admins e coordenadores podem ver todos os SDRs"
ON public.sdr FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

CREATE POLICY "SDRs podem ver seus próprios dados"
ON public.sdr FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins podem gerenciar SDRs"
ON public.sdr FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Políticas RLS para tabela sdr_comp_plan
CREATE POLICY "Admins e coordenadores podem ver todos os planos"
ON public.sdr_comp_plan FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

CREATE POLICY "SDRs podem ver seus próprios planos"
ON public.sdr_comp_plan FOR SELECT
USING (is_own_sdr(sdr_id));

CREATE POLICY "Admins podem gerenciar planos"
ON public.sdr_comp_plan FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Políticas RLS para tabela sdr_month_kpi
CREATE POLICY "Admins e coordenadores podem ver todos os KPIs"
ON public.sdr_month_kpi FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

CREATE POLICY "SDRs podem ver seus próprios KPIs"
ON public.sdr_month_kpi FOR SELECT
USING (is_own_sdr(sdr_id));

CREATE POLICY "Admins e coordenadores podem gerenciar KPIs"
ON public.sdr_month_kpi FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

-- Políticas RLS para tabela sdr_month_payout
CREATE POLICY "Admins e coordenadores podem ver todos os payouts"
ON public.sdr_month_payout FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

CREATE POLICY "SDRs podem ver seus próprios payouts"
ON public.sdr_month_payout FOR SELECT
USING (is_own_sdr(sdr_id));

CREATE POLICY "Admins e coordenadores podem gerenciar payouts"
ON public.sdr_month_payout FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

-- Políticas RLS para tabela sdr_payout_audit_log
CREATE POLICY "Admins e coordenadores podem ver logs"
ON public.sdr_payout_audit_log FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Sistema pode inserir logs"
ON public.sdr_payout_audit_log FOR INSERT
WITH CHECK (true);

-- Triggers para atualizar updated_at
CREATE TRIGGER update_sdr_updated_at
BEFORE UPDATE ON public.sdr
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sdr_comp_plan_updated_at
BEFORE UPDATE ON public.sdr_comp_plan
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sdr_month_kpi_updated_at
BEFORE UPDATE ON public.sdr_month_kpi
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sdr_month_payout_updated_at
BEFORE UPDATE ON public.sdr_month_payout
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();