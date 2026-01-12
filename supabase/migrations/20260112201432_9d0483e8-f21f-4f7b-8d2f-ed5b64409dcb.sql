-- =====================================================
-- BU CRÉDITO - Estrutura Completa
-- =====================================================

-- 1. Tabela de Produtos de Crédito
CREATE TABLE public.credit_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir os 6 produtos de crédito
INSERT INTO public.credit_products (code, name, description, display_order) VALUES
  ('mcf_capital', 'MCF Capital', 'Produto MCF Capital', 1),
  ('credito_he', '02 - MCF Crédito - HE', 'Home Equity', 2),
  ('credito_construcao', '03 - MCF Crédito - Construção', 'Crédito para construção', 3),
  ('credito_pre_ct', '09 - MCF Crédito - Pré-CT', 'Pré Carta de Crédito', 4),
  ('credito_imovel_pronto', '08 - MCF Crédito - Imóvel Pronto', 'Financiamento imóvel pronto', 5),
  ('credito_condo', '07 - MCF CRÉDITO CONDO', 'Crédito CONDO', 6);

-- 2. Tabela de Estágios por Produto
CREATE TABLE public.credit_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.credit_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  stage_order INTEGER NOT NULL DEFAULT 0,
  is_final BOOLEAN DEFAULT false,
  is_won BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir estágios padrão para cada produto
-- MCF Capital
INSERT INTO public.credit_stages (product_id, name, color, stage_order, is_final, is_won)
SELECT id, 'Lead', '#3B82F6', 1, false, false FROM public.credit_products WHERE code = 'mcf_capital'
UNION ALL SELECT id, 'Qualificação', '#8B5CF6', 2, false, false FROM public.credit_products WHERE code = 'mcf_capital'
UNION ALL SELECT id, 'Análise', '#F59E0B', 3, false, false FROM public.credit_products WHERE code = 'mcf_capital'
UNION ALL SELECT id, 'Aprovado', '#10B981', 4, false, false FROM public.credit_products WHERE code = 'mcf_capital'
UNION ALL SELECT id, 'Liberado', '#059669', 5, false, false FROM public.credit_products WHERE code = 'mcf_capital'
UNION ALL SELECT id, 'Quitado', '#047857', 6, true, true FROM public.credit_products WHERE code = 'mcf_capital'
UNION ALL SELECT id, 'Perdido', '#EF4444', 7, true, false FROM public.credit_products WHERE code = 'mcf_capital';

-- Crédito HE
INSERT INTO public.credit_stages (product_id, name, color, stage_order, is_final, is_won)
SELECT id, 'Lead', '#3B82F6', 1, false, false FROM public.credit_products WHERE code = 'credito_he'
UNION ALL SELECT id, 'Avaliação Imóvel', '#8B5CF6', 2, false, false FROM public.credit_products WHERE code = 'credito_he'
UNION ALL SELECT id, 'Análise', '#F59E0B', 3, false, false FROM public.credit_products WHERE code = 'credito_he'
UNION ALL SELECT id, 'Comitê', '#F97316', 4, false, false FROM public.credit_products WHERE code = 'credito_he'
UNION ALL SELECT id, 'Contrato', '#10B981', 5, false, false FROM public.credit_products WHERE code = 'credito_he'
UNION ALL SELECT id, 'Liberado', '#059669', 6, true, true FROM public.credit_products WHERE code = 'credito_he'
UNION ALL SELECT id, 'Perdido', '#EF4444', 7, true, false FROM public.credit_products WHERE code = 'credito_he';

-- Crédito Construção
INSERT INTO public.credit_stages (product_id, name, color, stage_order, is_final, is_won)
SELECT id, 'Lead', '#3B82F6', 1, false, false FROM public.credit_products WHERE code = 'credito_construcao'
UNION ALL SELECT id, 'Projeto', '#8B5CF6', 2, false, false FROM public.credit_products WHERE code = 'credito_construcao'
UNION ALL SELECT id, 'Análise', '#F59E0B', 3, false, false FROM public.credit_products WHERE code = 'credito_construcao'
UNION ALL SELECT id, 'Cronograma', '#F97316', 4, false, false FROM public.credit_products WHERE code = 'credito_construcao'
UNION ALL SELECT id, 'Liberação Etapas', '#10B981', 5, false, false FROM public.credit_products WHERE code = 'credito_construcao'
UNION ALL SELECT id, 'Quitado', '#047857', 6, true, true FROM public.credit_products WHERE code = 'credito_construcao'
UNION ALL SELECT id, 'Perdido', '#EF4444', 7, true, false FROM public.credit_products WHERE code = 'credito_construcao';

-- Crédito Pré-CT
INSERT INTO public.credit_stages (product_id, name, color, stage_order, is_final, is_won)
SELECT id, 'Lead', '#3B82F6', 1, false, false FROM public.credit_products WHERE code = 'credito_pre_ct'
UNION ALL SELECT id, 'Análise', '#F59E0B', 2, false, false FROM public.credit_products WHERE code = 'credito_pre_ct'
UNION ALL SELECT id, 'Aprovado', '#10B981', 3, false, false FROM public.credit_products WHERE code = 'credito_pre_ct'
UNION ALL SELECT id, 'Aguardando CT', '#8B5CF6', 4, false, false FROM public.credit_products WHERE code = 'credito_pre_ct'
UNION ALL SELECT id, 'Liberado', '#059669', 5, true, true FROM public.credit_products WHERE code = 'credito_pre_ct'
UNION ALL SELECT id, 'Perdido', '#EF4444', 6, true, false FROM public.credit_products WHERE code = 'credito_pre_ct';

-- Crédito Imóvel Pronto
INSERT INTO public.credit_stages (product_id, name, color, stage_order, is_final, is_won)
SELECT id, 'Lead', '#3B82F6', 1, false, false FROM public.credit_products WHERE code = 'credito_imovel_pronto'
UNION ALL SELECT id, 'Avaliação', '#8B5CF6', 2, false, false FROM public.credit_products WHERE code = 'credito_imovel_pronto'
UNION ALL SELECT id, 'Análise', '#F59E0B', 3, false, false FROM public.credit_products WHERE code = 'credito_imovel_pronto'
UNION ALL SELECT id, 'Contrato', '#10B981', 4, false, false FROM public.credit_products WHERE code = 'credito_imovel_pronto'
UNION ALL SELECT id, 'Registro', '#059669', 5, false, false FROM public.credit_products WHERE code = 'credito_imovel_pronto'
UNION ALL SELECT id, 'Liberado', '#047857', 6, true, true FROM public.credit_products WHERE code = 'credito_imovel_pronto'
UNION ALL SELECT id, 'Perdido', '#EF4444', 7, true, false FROM public.credit_products WHERE code = 'credito_imovel_pronto';

-- Crédito CONDO
INSERT INTO public.credit_stages (product_id, name, color, stage_order, is_final, is_won)
SELECT id, 'Lead', '#3B82F6', 1, false, false FROM public.credit_products WHERE code = 'credito_condo'
UNION ALL SELECT id, 'Análise Condo', '#8B5CF6', 2, false, false FROM public.credit_products WHERE code = 'credito_condo'
UNION ALL SELECT id, 'Aprovação', '#F59E0B', 3, false, false FROM public.credit_products WHERE code = 'credito_condo'
UNION ALL SELECT id, 'Contrato', '#10B981', 4, false, false FROM public.credit_products WHERE code = 'credito_condo'
UNION ALL SELECT id, 'Liberado', '#059669', 5, true, true FROM public.credit_products WHERE code = 'credito_condo'
UNION ALL SELECT id, 'Perdido', '#EF4444', 6, true, false FROM public.credit_products WHERE code = 'credito_condo';

-- 3. Tabela de Sócios/Parceiros
CREATE TABLE public.credit_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('capital_proprio', 'carta_consorcio')),
  valor_aportado NUMERIC DEFAULT 0,
  consorcio_card_id UUID REFERENCES public.consortium_cards(id),
  status TEXT DEFAULT 'ativo' CHECK (status IN ('prospect', 'negociacao', 'documentacao', 'ativo', 'inativo')),
  data_entrada DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Tabela de Deals de Crédito
CREATE TABLE public.credit_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.credit_products(id),
  stage_id UUID NOT NULL REFERENCES public.credit_stages(id),
  client_id UUID REFERENCES public.credit_clients(id),
  partner_id UUID REFERENCES public.credit_partners(id),
  
  -- Dados do deal
  titulo TEXT NOT NULL,
  valor_solicitado NUMERIC DEFAULT 0,
  valor_aprovado NUMERIC,
  taxa_juros NUMERIC,
  prazo_meses INTEGER,
  garantia TEXT,
  
  -- Datas importantes
  data_solicitacao DATE DEFAULT CURRENT_DATE,
  data_aprovacao DATE,
  data_liberacao DATE,
  data_quitacao DATE,
  
  -- Metadados
  owner_id UUID,
  observacoes TEXT,
  custom_fields JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Tabela de relação Sócio x Deals
CREATE TABLE public.credit_partner_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.credit_partners(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.credit_deals(id) ON DELETE CASCADE,
  comissao_pct NUMERIC DEFAULT 0,
  valor_comissao NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(partner_id, deal_id)
);

-- 6. Tabela de histórico/atividades de deals de crédito
CREATE TABLE public.credit_deal_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.credit_deals(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  from_stage_id UUID REFERENCES public.credit_stages(id),
  to_stage_id UUID REFERENCES public.credit_stages(id),
  description TEXT,
  user_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_credit_stages_product ON public.credit_stages(product_id);
CREATE INDEX idx_credit_deals_product ON public.credit_deals(product_id);
CREATE INDEX idx_credit_deals_stage ON public.credit_deals(stage_id);
CREATE INDEX idx_credit_deals_client ON public.credit_deals(client_id);
CREATE INDEX idx_credit_deals_partner ON public.credit_deals(partner_id);
CREATE INDEX idx_credit_partners_cpf ON public.credit_partners(cpf_cnpj);
CREATE INDEX idx_credit_deal_activities_deal ON public.credit_deal_activities(deal_id);

-- Enable RLS
ALTER TABLE public.credit_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_partner_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_deal_activities ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (leitura para todos autenticados)
CREATE POLICY "Authenticated users can read credit_products" ON public.credit_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read credit_stages" ON public.credit_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read credit_partners" ON public.credit_partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read credit_deals" ON public.credit_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read credit_partner_deals" ON public.credit_partner_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read credit_deal_activities" ON public.credit_deal_activities FOR SELECT TO authenticated USING (true);

-- Políticas de escrita
CREATE POLICY "Authenticated users can insert credit_partners" ON public.credit_partners FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update credit_partners" ON public.credit_partners FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert credit_deals" ON public.credit_deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update credit_deals" ON public.credit_deals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete credit_deals" ON public.credit_deals FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert credit_partner_deals" ON public.credit_partner_deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update credit_partner_deals" ON public.credit_partner_deals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert credit_deal_activities" ON public.credit_deal_activities FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_credit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_credit_products_updated_at BEFORE UPDATE ON public.credit_products FOR EACH ROW EXECUTE FUNCTION update_credit_updated_at();
CREATE TRIGGER update_credit_stages_updated_at BEFORE UPDATE ON public.credit_stages FOR EACH ROW EXECUTE FUNCTION update_credit_updated_at();
CREATE TRIGGER update_credit_partners_updated_at BEFORE UPDATE ON public.credit_partners FOR EACH ROW EXECUTE FUNCTION update_credit_updated_at();
CREATE TRIGGER update_credit_deals_updated_at BEFORE UPDATE ON public.credit_deals FOR EACH ROW EXECUTE FUNCTION update_credit_updated_at();