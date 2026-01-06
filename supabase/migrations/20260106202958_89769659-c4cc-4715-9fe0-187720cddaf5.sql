-- =====================================================
-- MÓDULO GENÉRICO DE RH E FECHAMENTO MCF
-- Fase 1: Estrutura de Dados
-- =====================================================

-- 1.1 Tabela cargos_catalogo
CREATE TABLE public.cargos_catalogo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area TEXT NOT NULL CHECK (area IN ('Inside Sales', 'Consórcio', 'Crédito', 'Marketing', 'Tecnologia', 'Financeiro', 'Projetos', 'Avulsos')),
  cargo_base TEXT NOT NULL,
  nivel INTEGER CHECK (nivel IS NULL OR (nivel >= 1 AND nivel <= 7)),
  nome_exibicao TEXT NOT NULL,
  ote_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  fixo_valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  variavel_valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  modelo_variavel TEXT NOT NULL DEFAULT 'componentes_regua_global' CHECK (modelo_variavel IN ('componentes_regua_global', 'score_metricas', 'fixo_puro')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 1.2 Tabela regua_multiplicador
CREATE TABLE public.regua_multiplicador (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_regua TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 1.2.1 Tabela regua_faixas (faixas da régua)
CREATE TABLE public.regua_faixas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  regua_id UUID NOT NULL REFERENCES public.regua_multiplicador(id) ON DELETE CASCADE,
  faixa_de NUMERIC(5,2) NOT NULL,
  faixa_ate NUMERIC(5,2) NOT NULL,
  multiplicador NUMERIC(5,2) NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 1.3 Tabela metas_mes
CREATE TABLE public.metas_mes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competencia TEXT NOT NULL, -- YYYY-MM
  area TEXT NOT NULL,
  cargo_base TEXT NOT NULL,
  nivel INTEGER,
  cargo_catalogo_id UUID REFERENCES public.cargos_catalogo(id),
  regua_id UUID REFERENCES public.regua_multiplicador(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(competencia, area, cargo_base, nivel)
);

-- 1.4 Tabela metas_componentes
CREATE TABLE public.metas_componentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_mes_id UUID NOT NULL REFERENCES public.metas_mes(id) ON DELETE CASCADE,
  nome_componente TEXT NOT NULL,
  valor_base NUMERIC(10,2) NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 1.5 Tabela fechamento_mes
CREATE TABLE public.fechamento_mes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competencia TEXT NOT NULL UNIQUE, -- YYYY-MM
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_revisao', 'aprovado', 'pago')),
  criado_por UUID,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  aprovado_por UUID,
  aprovado_em TIMESTAMP WITH TIME ZONE,
  observacao_geral TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 1.6 Tabela fechamento_pessoa
CREATE TABLE public.fechamento_pessoa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fechamento_mes_id UUID NOT NULL REFERENCES public.fechamento_mes(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  cargo_catalogo_id UUID REFERENCES public.cargos_catalogo(id),
  meta_mes_id UUID REFERENCES public.metas_mes(id),
  ote_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  fixo_valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  variavel_valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  percentual_global NUMERIC(5,4) NOT NULL DEFAULT 0,
  multiplicador NUMERIC(5,2) NOT NULL DEFAULT 0,
  variavel_paga NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_conta NUMERIC(10,2) NOT NULL DEFAULT 0,
  ifood_mensal NUMERIC(10,2) DEFAULT 0,
  ifood_ultrameta_global NUMERIC(10,2) DEFAULT 0,
  ifood_pendente NUMERIC(10,2) DEFAULT 0,
  ajuste_manual_valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  ajuste_manual_motivo TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'revisao', 'aprovado', 'enviado', 'pago')),
  marcado_critico BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fechamento_mes_id, employee_id)
);

-- 1.7 Tabela fechamento_componentes_realizado
CREATE TABLE public.fechamento_componentes_realizado (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fechamento_pessoa_id UUID NOT NULL REFERENCES public.fechamento_pessoa(id) ON DELETE CASCADE,
  meta_componente_id UUID NOT NULL REFERENCES public.metas_componentes(id),
  percentual_realizado NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (percentual_realizado >= 0 AND percentual_realizado <= 2),
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 1.8 Tabela auditoria_fechamento
CREATE TABLE public.auditoria_fechamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('criou', 'editou', 'importou_csv', 'recalculou', 'aprovou', 'ajustou_manual', 'enviou_comunicado', 'deletou')),
  antes_json JSONB,
  depois_json JSONB,
  usuario_id UUID,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 1.9 Adicionar cargo_catalogo_id em employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cargo_catalogo_id UUID REFERENCES public.cargos_catalogo(id);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX idx_cargos_catalogo_area ON public.cargos_catalogo(area);
CREATE INDEX idx_cargos_catalogo_ativo ON public.cargos_catalogo(ativo);
CREATE INDEX idx_metas_mes_competencia ON public.metas_mes(competencia);
CREATE INDEX idx_metas_mes_area_cargo ON public.metas_mes(area, cargo_base);
CREATE INDEX idx_fechamento_mes_competencia ON public.fechamento_mes(competencia);
CREATE INDEX idx_fechamento_pessoa_employee ON public.fechamento_pessoa(employee_id);
CREATE INDEX idx_fechamento_pessoa_status ON public.fechamento_pessoa(status);
CREATE INDEX idx_auditoria_entidade ON public.auditoria_fechamento(entidade, entidade_id);

-- =====================================================
-- RLS POLICIES (usando user_roles)
-- =====================================================

ALTER TABLE public.cargos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regua_multiplicador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regua_faixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_mes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_componentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechamento_mes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechamento_pessoa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechamento_componentes_realizado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_fechamento ENABLE ROW LEVEL SECURITY;

-- Policies para cargos_catalogo
CREATE POLICY "Authenticated users can view cargos" ON public.cargos_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage cargos" ON public.cargos_catalogo FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'financeiro'))
);

-- Policies para regua_multiplicador
CREATE POLICY "Authenticated users can view reguas" ON public.regua_multiplicador FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage reguas" ON public.regua_multiplicador FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'financeiro'))
);

-- Policies para regua_faixas
CREATE POLICY "Authenticated users can view faixas" ON public.regua_faixas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage faixas" ON public.regua_faixas FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'financeiro'))
);

-- Policies para metas_mes
CREATE POLICY "Authenticated users can view metas" ON public.metas_mes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage metas" ON public.metas_mes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'financeiro'))
);

-- Policies para metas_componentes
CREATE POLICY "Authenticated users can view componentes" ON public.metas_componentes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage componentes" ON public.metas_componentes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'financeiro'))
);

-- Policies para fechamento_mes
CREATE POLICY "Authenticated users can view fechamento_mes" ON public.fechamento_mes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage fechamento_mes" ON public.fechamento_mes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'financeiro'))
);

-- Policies para fechamento_pessoa
CREATE POLICY "Users can view own fechamento" ON public.fechamento_pessoa FOR SELECT TO authenticated USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'financeiro', 'coordenador'))
);
CREATE POLICY "Admins can manage fechamento_pessoa" ON public.fechamento_pessoa FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'financeiro'))
);

-- Policies para fechamento_componentes_realizado
CREATE POLICY "Users can view own componentes" ON public.fechamento_componentes_realizado FOR SELECT TO authenticated USING (
  fechamento_pessoa_id IN (
    SELECT fp.id FROM public.fechamento_pessoa fp
    JOIN public.employees e ON e.id = fp.employee_id
    WHERE e.user_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'financeiro', 'coordenador'))
);
CREATE POLICY "Admins can manage componentes_realizado" ON public.fechamento_componentes_realizado FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'financeiro'))
);

-- Policies para auditoria_fechamento
CREATE POLICY "Admins can view auditoria" ON public.auditoria_fechamento FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'financeiro'))
);
CREATE POLICY "All authenticated can insert auditoria" ON public.auditoria_fechamento FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- TRIGGERS para updated_at
-- =====================================================
CREATE TRIGGER update_cargos_catalogo_updated_at BEFORE UPDATE ON public.cargos_catalogo FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_regua_multiplicador_updated_at BEFORE UPDATE ON public.regua_multiplicador FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_metas_mes_updated_at BEFORE UPDATE ON public.metas_mes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fechamento_mes_updated_at BEFORE UPDATE ON public.fechamento_mes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fechamento_pessoa_updated_at BEFORE UPDATE ON public.fechamento_pessoa FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fechamento_componentes_updated_at BEFORE UPDATE ON public.fechamento_componentes_realizado FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Régua padrão MCF
INSERT INTO public.regua_multiplicador (id, nome_regua, ativo) VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Régua Padrão MCF', true);

INSERT INTO public.regua_faixas (regua_id, faixa_de, faixa_ate, multiplicador, ordem) VALUES
  ('a0000000-0000-0000-0000-000000000001', 0.00, 0.70, 0.00, 1),
  ('a0000000-0000-0000-0000-000000000001', 0.71, 0.85, 0.50, 2),
  ('a0000000-0000-0000-0000-000000000001', 0.86, 0.99, 0.70, 3),
  ('a0000000-0000-0000-0000-000000000001', 1.00, 1.19, 1.00, 4),
  ('a0000000-0000-0000-0000-000000000001', 1.20, 9.99, 1.50, 5);

-- Cargos iniciais (ADM Inside Sales)
INSERT INTO public.cargos_catalogo (area, cargo_base, nivel, nome_exibicao, ote_total, fixo_valor, variavel_valor, modelo_variavel) VALUES
  ('Inside Sales', 'ADM', 1, 'ADM1 Inside', 2500.00, 1300.00, 1200.00, 'componentes_regua_global'),
  ('Inside Sales', 'ADM', 2, 'ADM2 Inside', 2700.00, 1400.00, 1300.00, 'componentes_regua_global'),
  ('Inside Sales', 'ADM', 3, 'ADM3 Inside', 2900.00, 1500.00, 1400.00, 'componentes_regua_global'),
  ('Inside Sales', 'ADM', 4, 'ADM4 Inside', 3100.00, 1600.00, 1500.00, 'componentes_regua_global'),
  ('Inside Sales', 'ADM', 5, 'ADM5 Inside', 3300.00, 1700.00, 1600.00, 'componentes_regua_global'),
  ('Inside Sales', 'ADM', 6, 'ADM6 Inside', 3500.00, 1800.00, 1700.00, 'componentes_regua_global'),
  ('Inside Sales', 'ADM', 7, 'ADM7 Inside', 3700.00, 1900.00, 1800.00, 'componentes_regua_global'),
  ('Inside Sales', 'Gerente de Contas', NULL, 'Gerente de Contas Inside', 5000.00, 3000.00, 2000.00, 'componentes_regua_global'),
  ('Inside Sales', 'Coordenador', NULL, 'Coordenador Inside', 6000.00, 4000.00, 2000.00, 'componentes_regua_global');