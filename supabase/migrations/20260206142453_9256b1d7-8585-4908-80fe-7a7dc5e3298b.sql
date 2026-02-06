-- ====================================================
-- MÓDULO: CARTEIRA DE GERENTES DE CONTA (GR)
-- ====================================================

-- 1. Adicionar role 'gr' ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'gr';

-- 2. Criar enum para status do cliente na carteira
CREATE TYPE gr_entry_status AS ENUM (
  'ativo',           -- Em atendimento ativo
  'em_negociacao',   -- Negociando produto
  'em_pausa',        -- Pausado temporariamente
  'convertido',      -- Fechou produto
  'inativo',         -- Sem resposta/interesse
  'transferido'      -- Movido para outra carteira/BU
);

-- 3. Criar enum para tipos de ação do GR
CREATE TYPE gr_action_type AS ENUM (
  'reuniao_agendada',
  'reuniao_realizada',
  'diagnostico',
  'produto_sugerido',
  'produto_contratado',
  'nota',
  'encaminhamento_bu',
  'status_change',
  'contato_telefonico',
  'contato_whatsapp'
);

-- 4. Criar enum para modo de distribuição
CREATE TYPE gr_distribution_mode AS ENUM (
  'automatico',
  'manual'
);

-- ====================================================
-- TABELA: gr_wallets (Carteiras dos GRs)
-- ====================================================
CREATE TABLE public.gr_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bu TEXT NOT NULL DEFAULT 'incorporador',
  is_open BOOLEAN NOT NULL DEFAULT true,
  max_capacity INTEGER DEFAULT 50,
  current_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gr_user_id, bu)
);

-- ====================================================
-- TABELA: gr_wallet_entries (Clientes na carteira)
-- ====================================================
CREATE TABLE public.gr_wallet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.gr_wallets(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.hubla_transactions(id) ON DELETE SET NULL,
  
  -- Dados do cliente (snapshot para histórico)
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Status e origem
  status gr_entry_status NOT NULL DEFAULT 'ativo',
  entry_source TEXT NOT NULL DEFAULT 'carrinho', -- carrinho, manual, transferencia
  product_purchased TEXT, -- A001, A009, etc
  purchase_value NUMERIC(12,2),
  
  -- Gestão
  assigned_by UUID REFERENCES auth.users(id),
  entry_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_contact_at TIMESTAMPTZ,
  next_action_date DATE,
  
  -- Perfil e recomendações
  financial_profile JSONB DEFAULT '{}',
  recommended_products TEXT[] DEFAULT '{}',
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_gr_entries_wallet ON public.gr_wallet_entries(wallet_id);
CREATE INDEX idx_gr_entries_status ON public.gr_wallet_entries(status);
CREATE INDEX idx_gr_entries_email ON public.gr_wallet_entries(customer_email);
CREATE INDEX idx_gr_entries_contact ON public.gr_wallet_entries(contact_id);

-- ====================================================
-- TABELA: gr_actions (Ações do GR com o cliente)
-- ====================================================
CREATE TABLE public.gr_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.gr_wallet_entries(id) ON DELETE CASCADE,
  action_type gr_action_type NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gr_actions_entry ON public.gr_actions(entry_id);
CREATE INDEX idx_gr_actions_type ON public.gr_actions(action_type);

-- ====================================================
-- TABELA: gr_transfers_log (Log de transferências)
-- ====================================================
CREATE TABLE public.gr_transfers_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.gr_wallet_entries(id) ON DELETE CASCADE,
  from_wallet_id UUID REFERENCES public.gr_wallets(id),
  to_wallet_id UUID REFERENCES public.gr_wallets(id),
  reason TEXT,
  transferred_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================
-- TABELA: gr_distribution_rules (Regras de distribuição)
-- ====================================================
CREATE TABLE public.gr_distribution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bu TEXT NOT NULL UNIQUE,
  mode gr_distribution_mode NOT NULL DEFAULT 'automatico',
  balance_type TEXT NOT NULL DEFAULT 'capacity', -- capacity, equal, weighted
  manager_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir regra padrão para incorporador
INSERT INTO public.gr_distribution_rules (bu, mode, balance_type)
VALUES ('incorporador', 'automatico', 'capacity');

-- ====================================================
-- ENABLE RLS
-- ====================================================
ALTER TABLE public.gr_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gr_wallet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gr_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gr_transfers_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gr_distribution_rules ENABLE ROW LEVEL SECURITY;

-- ====================================================
-- RLS POLICIES: gr_wallets
-- ====================================================
-- Admin/Manager vê todas as carteiras
CREATE POLICY "Admin/Manager can view all wallets"
ON public.gr_wallets FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'coordenador')
);

-- GR vê apenas sua própria carteira
CREATE POLICY "GR can view own wallet"
ON public.gr_wallets FOR SELECT
TO authenticated
USING (gr_user_id = auth.uid());

-- Admin/Manager pode criar/atualizar carteiras
CREATE POLICY "Admin/Manager can manage wallets"
ON public.gr_wallets FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager')
);

-- ====================================================
-- RLS POLICIES: gr_wallet_entries
-- ====================================================
-- Admin/Manager vê todas as entradas
CREATE POLICY "Admin/Manager can view all entries"
ON public.gr_wallet_entries FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'coordenador')
);

-- GR vê apenas entradas da sua carteira
CREATE POLICY "GR can view own entries"
ON public.gr_wallet_entries FOR SELECT
TO authenticated
USING (
  wallet_id IN (
    SELECT id FROM public.gr_wallets WHERE gr_user_id = auth.uid()
  )
);

-- GR pode atualizar entradas da sua carteira
CREATE POLICY "GR can update own entries"
ON public.gr_wallet_entries FOR UPDATE
TO authenticated
USING (
  wallet_id IN (
    SELECT id FROM public.gr_wallets WHERE gr_user_id = auth.uid()
  )
);

-- Admin/Manager pode gerenciar todas as entradas
CREATE POLICY "Admin/Manager can manage all entries"
ON public.gr_wallet_entries FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager')
);

-- ====================================================
-- RLS POLICIES: gr_actions
-- ====================================================
-- Todos autenticados podem ver ações
CREATE POLICY "Authenticated can view actions"
ON public.gr_actions FOR SELECT
TO authenticated
USING (true);

-- GR pode criar ações em suas entradas
CREATE POLICY "GR can create actions on own entries"
ON public.gr_actions FOR INSERT
TO authenticated
WITH CHECK (
  entry_id IN (
    SELECT e.id FROM public.gr_wallet_entries e
    JOIN public.gr_wallets w ON e.wallet_id = w.id
    WHERE w.gr_user_id = auth.uid()
  ) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager')
);

-- ====================================================
-- RLS POLICIES: gr_transfers_log
-- ====================================================
CREATE POLICY "Authenticated can view transfers"
ON public.gr_transfers_log FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin/Manager can create transfers"
ON public.gr_transfers_log FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager')
);

-- ====================================================
-- RLS POLICIES: gr_distribution_rules
-- ====================================================
CREATE POLICY "Authenticated can view rules"
ON public.gr_distribution_rules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin/Manager can manage rules"
ON public.gr_distribution_rules FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager')
);

-- ====================================================
-- TRIGGERS: updated_at automático
-- ====================================================
CREATE OR REPLACE FUNCTION public.update_gr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gr_wallets_updated_at
BEFORE UPDATE ON public.gr_wallets
FOR EACH ROW EXECUTE FUNCTION public.update_gr_updated_at();

CREATE TRIGGER update_gr_wallet_entries_updated_at
BEFORE UPDATE ON public.gr_wallet_entries
FOR EACH ROW EXECUTE FUNCTION public.update_gr_updated_at();

CREATE TRIGGER update_gr_distribution_rules_updated_at
BEFORE UPDATE ON public.gr_distribution_rules
FOR EACH ROW EXECUTE FUNCTION public.update_gr_updated_at();

-- ====================================================
-- FUNÇÃO: Atualizar contador da carteira
-- ====================================================
CREATE OR REPLACE FUNCTION public.update_wallet_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.gr_wallets 
    SET current_count = current_count + 1 
    WHERE id = NEW.wallet_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.gr_wallets 
    SET current_count = current_count - 1 
    WHERE id = OLD.wallet_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.wallet_id != NEW.wallet_id THEN
    UPDATE public.gr_wallets 
    SET current_count = current_count - 1 
    WHERE id = OLD.wallet_id;
    UPDATE public.gr_wallets 
    SET current_count = current_count + 1 
    WHERE id = NEW.wallet_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_wallet_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.gr_wallet_entries
FOR EACH ROW EXECUTE FUNCTION public.update_wallet_count();

-- ====================================================
-- FUNÇÃO: Buscar próximo GR para distribuição
-- ====================================================
CREATE OR REPLACE FUNCTION public.get_next_gr_for_assignment(p_bu TEXT DEFAULT 'incorporador')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_wallet_id UUID;
BEGIN
  -- Buscar carteira aberta com menor carga (menor % de capacidade usada)
  SELECT w.id INTO next_wallet_id
  FROM gr_wallets w
  WHERE w.bu = p_bu
    AND w.is_open = true
    AND w.current_count < w.max_capacity
  ORDER BY (w.current_count::NUMERIC / NULLIF(w.max_capacity, 0)) ASC, random()
  LIMIT 1;
  
  RETURN next_wallet_id;
END;
$$;

-- ====================================================
-- FUNÇÃO: Atribuir parceiro ao GR
-- ====================================================
CREATE OR REPLACE FUNCTION public.assign_partner_to_gr(
  p_transaction_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_product TEXT,
  p_value NUMERIC,
  p_deal_id UUID DEFAULT NULL,
  p_contact_id UUID DEFAULT NULL,
  p_bu TEXT DEFAULT 'incorporador'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_entry_id UUID;
BEGIN
  -- Verificar se já existe entrada para esse email
  SELECT id INTO v_entry_id
  FROM gr_wallet_entries
  WHERE customer_email = p_customer_email
    AND status NOT IN ('transferido', 'inativo')
  LIMIT 1;
  
  IF v_entry_id IS NOT NULL THEN
    -- Já existe, retornar ID existente
    RETURN v_entry_id;
  END IF;
  
  -- Buscar próximo GR disponível
  v_wallet_id := get_next_gr_for_assignment(p_bu);
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma carteira disponível para distribuição';
  END IF;
  
  -- Criar entrada na carteira
  INSERT INTO gr_wallet_entries (
    wallet_id,
    deal_id,
    contact_id,
    transaction_id,
    customer_name,
    customer_email,
    customer_phone,
    product_purchased,
    purchase_value,
    entry_source,
    assigned_by
  )
  VALUES (
    v_wallet_id,
    p_deal_id,
    p_contact_id,
    p_transaction_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_product,
    p_value,
    'carrinho',
    auth.uid()
  )
  RETURNING id INTO v_entry_id;
  
  -- Registrar ação de entrada
  INSERT INTO gr_actions (entry_id, action_type, description, performed_by, metadata)
  VALUES (
    v_entry_id,
    'nota',
    'Cliente atribuído automaticamente via carrinho',
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
    jsonb_build_object(
      'source', 'carrinho',
      'product', p_product,
      'value', p_value
    )
  );
  
  RETURN v_entry_id;
END;
$$;