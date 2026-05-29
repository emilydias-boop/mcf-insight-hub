
-- ============ INDICADORES ============
CREATE TABLE public.consorcio_indicadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'externo' CHECK (tipo IN ('consorciado','externo')),
  card_id uuid REFERENCES public.consortium_cards(id) ON DELETE SET NULL,
  cpf text,
  telefone text,
  email text,
  pix text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consorcio_indicadores TO authenticated;
GRANT ALL ON public.consorcio_indicadores TO service_role;

ALTER TABLE public.consorcio_indicadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read indicadores" ON public.consorcio_indicadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write indicadores" ON public.consorcio_indicadores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_indicadores_card ON public.consorcio_indicadores(card_id);
CREATE INDEX idx_indicadores_nome ON public.consorcio_indicadores(lower(nome));

-- ============ INDICAÇÕES (cota indicada) ============
CREATE TABLE public.consorcio_indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES public.consorcio_indicadores(id) ON DELETE RESTRICT,
  card_id uuid NOT NULL UNIQUE REFERENCES public.consortium_cards(id) ON DELETE CASCADE,
  percentual numeric NOT NULL DEFAULT 1.0,           -- % sobre o crédito
  num_parcelas integer NOT NULL DEFAULT 5,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consorcio_indicacoes TO authenticated;
GRANT ALL ON public.consorcio_indicacoes TO service_role;

ALTER TABLE public.consorcio_indicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read indicacoes" ON public.consorcio_indicacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write indicacoes" ON public.consorcio_indicacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_indicacoes_indicador ON public.consorcio_indicacoes(indicador_id);

-- ============ PARCELAS DA INDICAÇÃO ============
CREATE TABLE public.consorcio_indicacao_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicacao_id uuid NOT NULL REFERENCES public.consorcio_indicacoes(id) ON DELETE CASCADE,
  numero_parcela integer NOT NULL,
  valor numeric NOT NULL,
  data_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  data_pagamento date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (indicacao_id, numero_parcela)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consorcio_indicacao_parcelas TO authenticated;
GRANT ALL ON public.consorcio_indicacao_parcelas TO service_role;

ALTER TABLE public.consorcio_indicacao_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read indicacao parcelas" ON public.consorcio_indicacao_parcelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write indicacao parcelas" ON public.consorcio_indicacao_parcelas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_indic_parcelas_indic ON public.consorcio_indicacao_parcelas(indicacao_id);
CREATE INDEX idx_indic_parcelas_venc ON public.consorcio_indicacao_parcelas(data_vencimento);

-- ============ Trigger updated_at ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_indicadores_updated BEFORE UPDATE ON public.consorcio_indicadores
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_indicacoes_updated BEFORE UPDATE ON public.consorcio_indicacoes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_indic_parcelas_updated BEFORE UPDATE ON public.consorcio_indicacao_parcelas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Função para (re)gerar parcelas de uma indicação ============
CREATE OR REPLACE FUNCTION public.generate_indicacao_parcelas(p_indicacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_id uuid;
  v_valor_credito numeric;
  v_data_contratacao date;
  v_data_reserva date;
  v_dia_venc int;
  v_percentual numeric;
  v_num integer;
  v_total numeric;
  v_parc_valor numeric;
  v_base date;
  v_venc date;
  i int;
BEGIN
  SELECT i.indicador_id, i.card_id, i.percentual, i.num_parcelas
    INTO v_card_id, v_card_id, v_percentual, v_num
  FROM public.consorcio_indicacoes i WHERE i.id = p_indicacao_id;

  SELECT i.card_id, i.percentual, i.num_parcelas
    INTO v_card_id, v_percentual, v_num
  FROM public.consorcio_indicacoes i WHERE i.id = p_indicacao_id;

  IF v_card_id IS NULL THEN RETURN; END IF;

  SELECT c.valor_credito, c.data_contratacao, c.data_reserva, c.dia_vencimento
    INTO v_valor_credito, v_data_contratacao, v_data_reserva, v_dia_venc
  FROM public.consortium_cards c WHERE c.id = v_card_id;

  v_total := COALESCE(v_valor_credito,0) * COALESCE(v_percentual,0) / 100.0;
  IF COALESCE(v_num,0) <= 0 THEN v_num := 5; END IF;
  v_parc_valor := round(v_total / v_num, 2);

  -- base = mês subsequente à contratação (ou reserva). dia = dia_vencimento da cota (fallback 10).
  v_base := COALESCE(v_data_contratacao, v_data_reserva, CURRENT_DATE);
  v_dia_venc := COALESCE(v_dia_venc, 10);

  -- limpa parcelas pendentes (não mexe nas já pagas)
  DELETE FROM public.consorcio_indicacao_parcelas
   WHERE indicacao_id = p_indicacao_id AND status <> 'pago';

  FOR i IN 1..v_num LOOP
    v_venc := (date_trunc('month', v_base) + (i || ' month')::interval)::date
              + (LEAST(v_dia_venc, 28) - 1);
    INSERT INTO public.consorcio_indicacao_parcelas
      (indicacao_id, numero_parcela, valor, data_vencimento, status)
    VALUES (p_indicacao_id, i, v_parc_valor, v_venc, 'pendente')
    ON CONFLICT (indicacao_id, numero_parcela) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_indicacao_after_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.generate_indicacao_parcelas(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_indicacao_ins AFTER INSERT ON public.consorcio_indicacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_indicacao_after_change();
CREATE TRIGGER trg_indicacao_upd AFTER UPDATE OF percentual, num_parcelas ON public.consorcio_indicacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_indicacao_after_change();
