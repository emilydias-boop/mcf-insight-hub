
-- ============================================================
-- Consorcio: Pos-contemplacao + Transferencia de cota
-- ============================================================

-- 1) Enums novos
DO $$ BEGIN
  CREATE TYPE public.pos_contemplacao_decisao AS ENUM ('manter','a_venda','em_transferencia','transferida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transfer_status_fase AS ENUM (
    'precificacao','comprador','analise_credito','documentacao',
    'transferencia_oficial','financeiro','concluida','cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transfer_tipo_contemplacao AS ENUM ('sorteio_50','sorteio_25','lance_50','lance_25','lance_fixo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transfer_analise_status AS ENUM ('pendente','em_analise','aprovado','reprovado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transfer_financial_tipo AS ENUM ('entrada_comprador','repasse_consorciado','comissao_empresa','taxa_administradora');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transfer_financial_status AS ENUM ('previsto','recebido','pago','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extender card_activity_category com 'transferencia'
ALTER TYPE public.card_activity_category ADD VALUE IF NOT EXISTS 'transferencia';

-- Extender card_activity_event com eventos de transferencia
ALTER TYPE public.card_activity_event ADD VALUE IF NOT EXISTS 'transfer_started';
ALTER TYPE public.card_activity_event ADD VALUE IF NOT EXISTS 'transfer_phase_changed';
ALTER TYPE public.card_activity_event ADD VALUE IF NOT EXISTS 'transfer_pricing_updated';
ALTER TYPE public.card_activity_event ADD VALUE IF NOT EXISTS 'transfer_buyer_updated';
ALTER TYPE public.card_activity_event ADD VALUE IF NOT EXISTS 'transfer_credit_updated';
ALTER TYPE public.card_activity_event ADD VALUE IF NOT EXISTS 'transfer_official_updated';
ALTER TYPE public.card_activity_event ADD VALUE IF NOT EXISTS 'transfer_financial_changed';
ALTER TYPE public.card_activity_event ADD VALUE IF NOT EXISTS 'transfer_completed';
ALTER TYPE public.card_activity_event ADD VALUE IF NOT EXISTS 'transfer_cancelled';
ALTER TYPE public.card_activity_event ADD VALUE IF NOT EXISTS 'pos_contemplacao_decision';

-- 2) Colunas na consortium_cards
ALTER TABLE public.consortium_cards
  ADD COLUMN IF NOT EXISTS pos_contemplacao_decisao public.pos_contemplacao_decisao,
  ADD COLUMN IF NOT EXISTS data_decisao_pos_contemplacao timestamptz;

-- 3) Tabela principal de transferencias
CREATE TABLE IF NOT EXISTS public.consortium_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.consortium_cards(id) ON DELETE CASCADE,
  status_fase public.transfer_status_fase NOT NULL DEFAULT 'precificacao',
  -- Contemplacao base
  tipo_contemplacao public.transfer_tipo_contemplacao,
  usou_capital_proprio boolean NOT NULL DEFAULT false,
  valor_capital_proprio numeric(14,2),
  data_assembleia date,
  -- Precificacao
  valor_lance numeric(14,2),
  valor_credito_disponivel numeric(14,2),
  valor_total_comprador numeric(14,2),
  valor_comissao_empresa numeric(14,2),
  valor_repasse_consorciado numeric(14,2),
  observacoes_precificacao text,
  -- Analise de credito
  analise_status public.transfer_analise_status NOT NULL DEFAULT 'pendente',
  analise_data date,
  analise_observacao text,
  -- Transferencia oficial
  protocolo_admin text,
  data_envio_admin date,
  data_efetivacao date,
  nova_cota text,
  -- Controle
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  cancelado_em timestamptz,
  motivo_cancelamento text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Apenas 1 transferencia ativa por carta
CREATE UNIQUE INDEX IF NOT EXISTS uq_consortium_transfers_active_per_card
  ON public.consortium_transfers (card_id)
  WHERE status_fase NOT IN ('concluida','cancelada');

CREATE INDEX IF NOT EXISTS idx_consortium_transfers_card ON public.consortium_transfers(card_id);
CREATE INDEX IF NOT EXISTS idx_consortium_transfers_status ON public.consortium_transfers(status_fase);

-- 4) Buyer
CREATE TABLE IF NOT EXISTS public.consortium_transfer_buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL UNIQUE REFERENCES public.consortium_transfers(id) ON DELETE CASCADE,
  tipo_pessoa text NOT NULL DEFAULT 'pf',
  -- PF
  nome_completo text,
  cpf text,
  rg text,
  data_nascimento date,
  estado_civil text,
  profissao text,
  renda numeric(14,2),
  -- PJ
  razao_social text,
  cnpj text,
  natureza_juridica text,
  inscricao_estadual text,
  data_fundacao date,
  faturamento_mensal numeric(14,2),
  -- Endereco
  endereco_cep text,
  endereco_rua text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_estado text,
  -- Contato
  telefone text,
  email text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Documentos
CREATE TABLE IF NOT EXISTS public.consortium_transfer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.consortium_transfers(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  nome_arquivo text NOT NULL,
  storage_path text,
  storage_url text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfer_docs_transfer ON public.consortium_transfer_documents(transfer_id);

-- 6) Financeiro
CREATE TABLE IF NOT EXISTS public.consortium_transfer_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.consortium_transfers(id) ON DELETE CASCADE,
  tipo public.transfer_financial_tipo NOT NULL,
  valor numeric(14,2) NOT NULL,
  data_prevista date,
  data_realizada date,
  status public.transfer_financial_status NOT NULL DEFAULT 'previsto',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfer_fin_transfer ON public.consortium_transfer_financials(transfer_id);

-- 7) RLS - autenticados
ALTER TABLE public.consortium_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_transfer_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_transfer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_transfer_financials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all consortium_transfers" ON public.consortium_transfers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth all consortium_transfer_buyers" ON public.consortium_transfer_buyers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth all consortium_transfer_documents" ON public.consortium_transfer_documents
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth all consortium_transfer_financials" ON public.consortium_transfer_financials
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8) updated_at triggers
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS tg_consortium_transfers_updated ON public.consortium_transfers;
CREATE TRIGGER tg_consortium_transfers_updated BEFORE UPDATE ON public.consortium_transfers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS tg_consortium_transfer_buyers_updated ON public.consortium_transfer_buyers;
CREATE TRIGGER tg_consortium_transfer_buyers_updated BEFORE UPDATE ON public.consortium_transfer_buyers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS tg_consortium_transfer_financials_updated ON public.consortium_transfer_financials;
CREATE TRIGGER tg_consortium_transfer_financials_updated BEFORE UPDATE ON public.consortium_transfer_financials
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 9) Trigger: log de eventos de transferencia
CREATE OR REPLACE FUNCTION public.tg_log_consortium_transfer_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.card_activity_event;
  v_desc text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'transfer_started';
    v_desc := 'Processo de transferência iniciado';
    INSERT INTO public.consortium_card_activity_log
      (card_id, event_category, event_type, description, after_value, actor_id)
    VALUES (NEW.card_id, 'transferencia', v_event, v_desc,
            jsonb_build_object('transfer_id', NEW.id, 'status_fase', NEW.status_fase),
            NEW.created_by);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status_fase IS DISTINCT FROM OLD.status_fase THEN
      IF NEW.status_fase = 'concluida' THEN
        v_event := 'transfer_completed';
        v_desc := 'Transferência concluída';
      ELSIF NEW.status_fase = 'cancelada' THEN
        v_event := 'transfer_cancelled';
        v_desc := COALESCE('Transferência cancelada: '||NEW.motivo_cancelamento,'Transferência cancelada');
      ELSE
        v_event := 'transfer_phase_changed';
        v_desc := 'Fase alterada para '||NEW.status_fase::text;
      END IF;
      INSERT INTO public.consortium_card_activity_log
        (card_id, event_category, event_type, description, before_value, after_value)
      VALUES (NEW.card_id, 'transferencia', v_event, v_desc,
              jsonb_build_object('status_fase', OLD.status_fase),
              jsonb_build_object('status_fase', NEW.status_fase, 'transfer_id', NEW.id));
    END IF;

    IF (NEW.valor_lance IS DISTINCT FROM OLD.valor_lance)
       OR (NEW.valor_total_comprador IS DISTINCT FROM OLD.valor_total_comprador)
       OR (NEW.valor_comissao_empresa IS DISTINCT FROM OLD.valor_comissao_empresa)
       OR (NEW.valor_repasse_consorciado IS DISTINCT FROM OLD.valor_repasse_consorciado) THEN
      INSERT INTO public.consortium_card_activity_log
        (card_id, event_category, event_type, description, before_value, after_value)
      VALUES (NEW.card_id, 'transferencia', 'transfer_pricing_updated', 'Precificação atualizada',
              jsonb_build_object('lance', OLD.valor_lance, 'total', OLD.valor_total_comprador,
                                  'comissao', OLD.valor_comissao_empresa, 'repasse', OLD.valor_repasse_consorciado),
              jsonb_build_object('lance', NEW.valor_lance, 'total', NEW.valor_total_comprador,
                                  'comissao', NEW.valor_comissao_empresa, 'repasse', NEW.valor_repasse_consorciado));
    END IF;

    IF NEW.analise_status IS DISTINCT FROM OLD.analise_status THEN
      INSERT INTO public.consortium_card_activity_log
        (card_id, event_category, event_type, description, before_value, after_value)
      VALUES (NEW.card_id, 'transferencia', 'transfer_credit_updated',
              'Análise de crédito: '||NEW.analise_status::text,
              jsonb_build_object('analise_status', OLD.analise_status),
              jsonb_build_object('analise_status', NEW.analise_status));
    END IF;

    IF (NEW.protocolo_admin IS DISTINCT FROM OLD.protocolo_admin)
       OR (NEW.data_envio_admin IS DISTINCT FROM OLD.data_envio_admin)
       OR (NEW.data_efetivacao IS DISTINCT FROM OLD.data_efetivacao) THEN
      INSERT INTO public.consortium_card_activity_log
        (card_id, event_category, event_type, description, before_value, after_value)
      VALUES (NEW.card_id, 'transferencia', 'transfer_official_updated','Dados oficiais atualizados',
              jsonb_build_object('protocolo', OLD.protocolo_admin, 'envio', OLD.data_envio_admin, 'efetivacao', OLD.data_efetivacao),
              jsonb_build_object('protocolo', NEW.protocolo_admin, 'envio', NEW.data_envio_admin, 'efetivacao', NEW.data_efetivacao));
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_log_consortium_transfer_activity ON public.consortium_transfers;
CREATE TRIGGER tg_log_consortium_transfer_activity
AFTER INSERT OR UPDATE ON public.consortium_transfers
FOR EACH ROW EXECUTE FUNCTION public.tg_log_consortium_transfer_activity();

-- 10) Trigger: ao concluir, marca carta como transferida e copia titular do buyer
CREATE OR REPLACE FUNCTION public.tg_apply_transfer_on_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_buyer public.consortium_transfer_buyers%ROWTYPE;
BEGIN
  IF NEW.status_fase = 'concluida' AND OLD.status_fase IS DISTINCT FROM 'concluida' THEN
    NEW.concluido_em := COALESCE(NEW.concluido_em, now());
    SELECT * INTO v_buyer FROM public.consortium_transfer_buyers WHERE transfer_id = NEW.id;
    IF v_buyer.id IS NOT NULL THEN
      UPDATE public.consortium_cards SET
        tipo_pessoa = COALESCE(v_buyer.tipo_pessoa, tipo_pessoa),
        nome_completo = COALESCE(v_buyer.nome_completo, nome_completo),
        cpf = COALESCE(v_buyer.cpf, cpf),
        rg = COALESCE(v_buyer.rg, rg),
        data_nascimento = COALESCE(v_buyer.data_nascimento, data_nascimento),
        estado_civil = COALESCE(v_buyer.estado_civil::text, estado_civil::text)::estado_civil,
        profissao = COALESCE(v_buyer.profissao, profissao),
        renda = COALESCE(v_buyer.renda, renda),
        razao_social = COALESCE(v_buyer.razao_social, razao_social),
        cnpj = COALESCE(v_buyer.cnpj, cnpj),
        natureza_juridica = COALESCE(v_buyer.natureza_juridica, natureza_juridica),
        inscricao_estadual = COALESCE(v_buyer.inscricao_estadual, inscricao_estadual),
        data_fundacao = COALESCE(v_buyer.data_fundacao, data_fundacao),
        faturamento_mensal = COALESCE(v_buyer.faturamento_mensal, faturamento_mensal),
        endereco_cep = COALESCE(v_buyer.endereco_cep, endereco_cep),
        endereco_rua = COALESCE(v_buyer.endereco_rua, endereco_rua),
        endereco_numero = COALESCE(v_buyer.endereco_numero, endereco_numero),
        endereco_complemento = COALESCE(v_buyer.endereco_complemento, endereco_complemento),
        endereco_bairro = COALESCE(v_buyer.endereco_bairro, endereco_bairro),
        endereco_cidade = COALESCE(v_buyer.endereco_cidade, endereco_cidade),
        endereco_estado = COALESCE(v_buyer.endereco_estado, endereco_estado),
        telefone = COALESCE(v_buyer.telefone, telefone),
        email = COALESCE(v_buyer.email, email),
        cota = COALESCE(NEW.nova_cota, cota),
        pos_contemplacao_decisao = 'transferida',
        data_decisao_pos_contemplacao = now()
      WHERE id = NEW.card_id;
    ELSE
      UPDATE public.consortium_cards
        SET pos_contemplacao_decisao = 'transferida',
            data_decisao_pos_contemplacao = now()
      WHERE id = NEW.card_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_apply_transfer_on_complete ON public.consortium_transfers;
CREATE TRIGGER tg_apply_transfer_on_complete
BEFORE UPDATE ON public.consortium_transfers
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_transfer_on_complete();
