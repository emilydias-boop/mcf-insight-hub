
-- ============================================================================
-- Módulo Financeiro > À Receber
-- ============================================================================

-- 1) TABELA PRINCIPAL: ar_titulos (uma venda = um título)
CREATE TABLE public.ar_titulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hubla_transaction_id uuid REFERENCES public.hubla_transactions(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  customer_document text,
  product_name text NOT NULL,
  product_code text,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  total_installments_hubla integer DEFAULT 1,
  tipo text NOT NULL DEFAULT 'pendente_lancamento',
    -- 'integral' | 'parcelado' | 'pendente_lancamento'
  status text NOT NULL DEFAULT 'aberto',
    -- 'aberto' | 'quitado' | 'cancelado'
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sale_date timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT ar_titulos_tipo_chk CHECK (tipo IN ('integral','parcelado','pendente_lancamento')),
  CONSTRAINT ar_titulos_status_chk CHECK (status IN ('aberto','quitado','cancelado'))
);

CREATE INDEX idx_ar_titulos_status ON public.ar_titulos(status);
CREATE INDEX idx_ar_titulos_responsavel ON public.ar_titulos(responsavel_id);
CREATE INDEX idx_ar_titulos_product_code ON public.ar_titulos(product_code);
CREATE INDEX idx_ar_titulos_sale_date ON public.ar_titulos(sale_date);
CREATE UNIQUE INDEX idx_ar_titulos_hubla_tx ON public.ar_titulos(hubla_transaction_id) WHERE hubla_transaction_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ar_titulos TO authenticated;
GRANT ALL ON public.ar_titulos TO service_role;

ALTER TABLE public.ar_titulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro e admin gerenciam titulos AR"
  ON public.ar_titulos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

-- 2) PARCELAS
CREATE TABLE public.ar_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid NOT NULL REFERENCES public.ar_titulos(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  tipo_parcela text NOT NULL DEFAULT 'parcela',
    -- 'entrada' | 'parcela'
  valor numeric(12,2) NOT NULL,
  data_vencimento date NOT NULL,
  data_pagamento date,
  valor_pago numeric(12,2),
  forma_pagamento text,
  status text NOT NULL DEFAULT 'pendente',
    -- 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ar_parcelas_tipo_chk CHECK (tipo_parcela IN ('entrada','parcela')),
  CONSTRAINT ar_parcelas_status_chk CHECK (status IN ('pendente','pago','atrasado','cancelado'))
);

CREATE INDEX idx_ar_parcelas_titulo ON public.ar_parcelas(titulo_id);
CREATE INDEX idx_ar_parcelas_status ON public.ar_parcelas(status);
CREATE INDEX idx_ar_parcelas_venc ON public.ar_parcelas(data_vencimento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ar_parcelas TO authenticated;
GRANT ALL ON public.ar_parcelas TO service_role;

ALTER TABLE public.ar_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro e admin gerenciam parcelas AR"
  ON public.ar_parcelas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

-- 3) HISTÓRICO
CREATE TABLE public.ar_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid NOT NULL REFERENCES public.ar_titulos(id) ON DELETE CASCADE,
  parcela_id uuid REFERENCES public.ar_parcelas(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  descricao text,
  valor numeric(12,2),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_ar_historico_titulo ON public.ar_historico(titulo_id);
CREATE INDEX idx_ar_historico_created_at ON public.ar_historico(created_at DESC);

GRANT SELECT, INSERT ON public.ar_historico TO authenticated;
GRANT ALL ON public.ar_historico TO service_role;

ALTER TABLE public.ar_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro e admin veem historico AR"
  ON public.ar_historico FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

CREATE POLICY "Financeiro e admin inserem historico AR"
  ON public.ar_historico FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

-- 4) TRIGGER updated_at genérico
CREATE OR REPLACE FUNCTION public.ar_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_ar_titulos_updated BEFORE UPDATE ON public.ar_titulos
  FOR EACH ROW EXECUTE FUNCTION public.ar_touch_updated_at();
CREATE TRIGGER trg_ar_parcelas_updated BEFORE UPDATE ON public.ar_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.ar_touch_updated_at();

-- 5) FUNÇÃO: extrai code (A001/A003/A009…) do product_name
CREATE OR REPLACE FUNCTION public.ar_extract_product_code(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT UPPER(substring(coalesce(p_name,'') FROM '^[Aa]([0-9]{3})'));
$$;

-- 6) TRIGGER PRINCIPAL: cria título AR quando entra venda Hubla dos produtos alvo
--    - integral (total_installments = 1): título 'integral' + 1 parcela PENDENTE
--    - parcelado (>1): título 'parcelado' SEM parcelas (gestor lança entrada + parcelas)
CREATE OR REPLACE FUNCTION public.ar_create_from_hubla()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  v_titulo_id uuid;
  v_tipo text;
BEGIN
  -- só interessa venda concluída
  IF coalesce(NEW.sale_status,'') NOT IN ('completed','paid','approved') THEN
    RETURN NEW;
  END IF;

  -- extrai código do produto
  v_code := NULL;
  IF NEW.product_name ILIKE 'A001%' THEN v_code := 'A001';
  ELSIF NEW.product_name ILIKE 'A002%' THEN v_code := 'A002';
  ELSIF NEW.product_name ILIKE 'A003%' THEN v_code := 'A003';
  ELSIF NEW.product_name ILIKE 'A004%' THEN v_code := 'A004';
  ELSIF NEW.product_name ILIKE 'A009%' THEN v_code := 'A009';
  END IF;

  -- só produtos alvo
  IF v_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- evita duplicar por retry do webhook
  IF EXISTS (SELECT 1 FROM public.ar_titulos WHERE hubla_transaction_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_tipo := CASE
    WHEN coalesce(NEW.total_installments,1) <= 1 THEN 'integral'
    ELSE 'parcelado'
  END;

  INSERT INTO public.ar_titulos (
    hubla_transaction_id, customer_name, customer_email, customer_phone, customer_document,
    product_name, product_code, valor_total, payment_method,
    total_installments_hubla, tipo, status, sale_date
  ) VALUES (
    NEW.id, coalesce(NEW.customer_name,'(sem nome)'), NEW.customer_email, NEW.customer_phone, NEW.customer_document,
    NEW.product_name, v_code, coalesce(NEW.product_price,0), NEW.payment_method,
    coalesce(NEW.total_installments,1), v_tipo, 'aberto', NEW.sale_date
  ) RETURNING id INTO v_titulo_id;

  -- integral: cria parcela única PENDENTE (gestor confirma recebimento)
  IF v_tipo = 'integral' THEN
    INSERT INTO public.ar_parcelas (
      titulo_id, numero, tipo_parcela, valor, data_vencimento, status
    ) VALUES (
      v_titulo_id, 1, 'parcela', coalesce(NEW.product_price,0),
      coalesce(NEW.sale_date::date, current_date), 'pendente'
    );
  END IF;

  INSERT INTO public.ar_historico (titulo_id, tipo, descricao, valor)
  VALUES (
    v_titulo_id,
    'criacao_automatica',
    'Título criado automaticamente via webhook Hubla ('||v_tipo||')',
    coalesce(NEW.product_price,0)
  );

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_hubla_to_ar
  AFTER INSERT ON public.hubla_transactions
  FOR EACH ROW EXECUTE FUNCTION public.ar_create_from_hubla();
