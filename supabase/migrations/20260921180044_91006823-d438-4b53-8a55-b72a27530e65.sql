-- =========================================================
-- Painel "Índices Class" (Embracon 12-6 e 8-2) — schema novo
-- Nenhuma alteração em tabelas existentes.
-- =========================================================

-- 1) Produção mensal (denominador oficial)
CREATE TABLE public.embracon_producao_mensal (
  mes date PRIMARY KEY,
  valor numeric NOT NULL,
  fonte text NOT NULL DEFAULT 'planilha_guilherme',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.embracon_producao_mensal TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.embracon_producao_mensal TO authenticated;
GRANT ALL ON public.embracon_producao_mensal TO service_role;
ALTER TABLE public.embracon_producao_mensal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "producao_mensal_read" ON public.embracon_producao_mensal
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "producao_mensal_write" ON public.embracon_producao_mensal
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Carga inicial (série da seção 5 da espec; R$ mi -> reais)
INSERT INTO public.embracon_producao_mensal (mes, valor, fonte) VALUES
  ('2025-04-01', 34890000, 'planilha_guilherme'),
  ('2025-05-01', 22480000, 'planilha_guilherme'),
  ('2025-06-01', 24100000, 'planilha_guilherme'),
  ('2025-07-01', 52410000, 'planilha_guilherme'),
  ('2025-08-01', 14290000, 'planilha_guilherme'),
  ('2025-09-01', 23110000, 'planilha_guilherme'),
  ('2025-10-01', 15080000, 'planilha_guilherme'),
  ('2025-11-01', 12260000, 'planilha_guilherme'),
  ('2025-12-01', 28700000, 'planilha_guilherme'),
  ('2026-01-01', 15610000, 'planilha_guilherme'),
  ('2026-02-01', 28260000, 'planilha_guilherme'),
  ('2026-03-01', 29190000, 'planilha_guilherme'),
  ('2026-04-01', 30520000, 'planilha_guilherme'),
  ('2026-05-01', 22980000, 'planilha_guilherme'),
  ('2026-06-01', 31600000, 'planilha_guilherme'),
  ('2026-07-01', 83340000, 'planilha_guilherme'),
  ('2026-08-01', 19810000, 'planilha_guilherme');

-- 2) Importação de status por cota (insert-only)
CREATE TABLE public.embracon_cota_status_import (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia date NOT NULL,
  grupo text NOT NULL,
  cota text NOT NULL,
  contrato text,
  valor_bem numeric,
  mes_producao date,
  status text NOT NULL CHECK (status IN ('ativa_em_dia','inadimplente','cancelada','reativada')),
  parcelas_vencidas integer,
  plano text,
  fonte text NOT NULL DEFAULT 'power_bi' CHECK (fonte IN ('power_bi','financehub','deduzido_comissao')),
  importado_por uuid,
  importado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_referencia, grupo, cota)
);
CREATE INDEX idx_ecsi_grupo_cota ON public.embracon_cota_status_import (grupo, cota, data_referencia DESC);
CREATE INDEX idx_ecsi_mes_producao ON public.embracon_cota_status_import (mes_producao);
GRANT SELECT, INSERT ON public.embracon_cota_status_import TO authenticated;
GRANT ALL ON public.embracon_cota_status_import TO service_role;
ALTER TABLE public.embracon_cota_status_import ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cota_status_import_read" ON public.embracon_cota_status_import
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cota_status_import_insert" ON public.embracon_cota_status_import
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- 3) Snapshots dos índices (insert-only)
CREATE TABLE public.embracon_indices_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_apuracao date NOT NULL,
  indice text NOT NULL CHECK (indice IN ('12-6','8-2')),
  numerador numeric,
  denominador numeric,
  valor numeric,
  qtd_cotas integer,
  fonte text NOT NULL CHECK (fonte IN ('calculado','power_bi')),
  registrado_por uuid,
  registrado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eis_mes ON public.embracon_indices_snapshot (mes_apuracao, indice);
GRANT SELECT, INSERT ON public.embracon_indices_snapshot TO authenticated;
GRANT ALL ON public.embracon_indices_snapshot TO service_role;
ALTER TABLE public.embracon_indices_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "indices_snapshot_read" ON public.embracon_indices_snapshot
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "indices_snapshot_insert" ON public.embracon_indices_snapshot
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- 4) Configuração (linha única)
CREATE TABLE public.embracon_class_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta numeric NOT NULL DEFAULT 0.25,
  bonus_pct numeric NOT NULL DEFAULT 0.006,
  janela_126_inicio integer NOT NULL DEFAULT 11,
  janela_126_fim integer NOT NULL DEFAULT 6,
  janela_82_inicio integer NOT NULL DEFAULT 7,
  janela_82_fim integer NOT NULL DEFAULT 2,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.embracon_class_config TO authenticated;
GRANT ALL ON public.embracon_class_config TO service_role;
ALTER TABLE public.embracon_class_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_config_read" ON public.embracon_class_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "class_config_write" ON public.embracon_class_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
INSERT INTO public.embracon_class_config (id) VALUES (true);

-- 5) RPC de cálculo
CREATE OR REPLACE FUNCTION public.embracon_indices_class(p_mes date)
RETURNS TABLE (
  mes_apuracao date,
  indice text,
  janela_inicio date,
  janela_fim date,
  denominador numeric,
  denominador_mcf numeric,
  numerador numeric,
  numerador_canceladas numeric,
  numerador_inadimplentes numeric,
  indice_valor numeric,
  qtd_cotas integer,
  meta numeric,
  falta_para_meta numeric,
  cotas_para_meta integer,
  tem_importacao boolean,
  breakdown jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg public.embracon_class_config;
  v_base date := date_trunc('month', p_mes)::date;
  v_offset int;
  v_ind text;
  v_mes date;
  v_ini date;
  v_fim date;
  v_den numeric;
  v_den_mcf numeric;
  v_canc numeric;
  v_inad numeric;
  v_num numeric;
  v_qtd int;
  v_medio numeric;
  v_falta numeric;
  v_break jsonb;
  v_tem boolean;
BEGIN
  SELECT * INTO v_cfg FROM public.embracon_class_config WHERE id LIMIT 1;
  IF v_cfg IS NULL THEN
    v_cfg.meta := 0.25; v_cfg.janela_126_inicio := 11; v_cfg.janela_126_fim := 6;
    v_cfg.janela_82_inicio := 7; v_cfg.janela_82_fim := 2;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.embracon_cota_status_import) INTO v_tem;

  FOR v_offset IN 0..3 LOOP
    v_mes := (v_base + (v_offset || ' month')::interval)::date;
    FOREACH v_ind IN ARRAY ARRAY['12-6','8-2'] LOOP
      IF v_ind = '12-6' THEN
        v_ini := (v_mes - (v_cfg.janela_126_inicio || ' month')::interval)::date;
        v_fim := (v_mes - (v_cfg.janela_126_fim || ' month')::interval)::date;
      ELSE
        v_ini := (v_mes - (v_cfg.janela_82_inicio || ' month')::interval)::date;
        v_fim := (v_mes - (v_cfg.janela_82_fim || ' month')::interval)::date;
      END IF;

      -- denominador oficial (produção mensal lançada)
      SELECT COALESCE(SUM(valor), 0) INTO v_den
      FROM public.embracon_producao_mensal
      WHERE mes >= v_ini AND mes <= v_fim;

      -- denominador alternativo: cotas do MCF Gestão na mesma janela
      SELECT COALESCE(SUM(c.valor_credito), 0) INTO v_den_mcf
      FROM public.consortium_cards c
      WHERE date_trunc('month', COALESCE(c.data_contratacao, c.data_reserva, c.created_at::date))::date
            BETWEEN v_ini AND v_fim;

      -- última importação de cada cota
      WITH ult AS (
        SELECT DISTINCT ON (i.grupo, i.cota) i.*
        FROM public.embracon_cota_status_import i
        ORDER BY i.grupo, i.cota, i.data_referencia DESC, i.importado_em DESC
      ), jan AS (
        SELECT * FROM ult
        WHERE mes_producao IS NOT NULL
          AND date_trunc('month', mes_producao)::date BETWEEN v_ini AND v_fim
      )
      SELECT
        COALESCE(SUM(CASE WHEN status = 'cancelada' THEN COALESCE(valor_bem,0) END), 0),
        COALESCE(SUM(CASE WHEN status = 'inadimplente' THEN COALESCE(valor_bem,0) END), 0),
        COUNT(*) FILTER (WHERE status = 'cancelada'
          OR (v_ind = '8-2' AND status = 'inadimplente')),
        AVG(NULLIF(valor_bem,0)) FILTER (WHERE status = 'cancelada')
      INTO v_canc, v_inad, v_qtd, v_medio
      FROM jan;

      IF v_ind = '12-6' THEN
        v_num := v_canc;
        v_inad := 0;
      ELSE
        v_num := v_canc + v_inad;
      END IF;

      v_falta := v_num - (v_cfg.meta * v_den);

      -- numerador aberto por mês de produção
      WITH ult AS (
        SELECT DISTINCT ON (i.grupo, i.cota) i.*
        FROM public.embracon_cota_status_import i
        ORDER BY i.grupo, i.cota, i.data_referencia DESC, i.importado_em DESC
      ), meses AS (
        SELECT generate_series(v_ini, v_fim, interval '1 month')::date AS m
      )
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'mes', m.m,
        'producao', COALESCE(pm.valor, 0),
        'qtd_canceladas', COALESCE(agg.qtd_canc, 0),
        'credito_canceladas', COALESCE(agg.canc, 0),
        'qtd_inadimplentes', COALESCE(agg.qtd_inad, 0),
        'credito_inadimplentes', CASE WHEN v_ind = '8-2' THEN COALESCE(agg.inad, 0) ELSE 0 END
      ) ORDER BY m.m), '[]'::jsonb)
      INTO v_break
      FROM meses m
      LEFT JOIN public.embracon_producao_mensal pm ON pm.mes = m.m
      LEFT JOIN (
        SELECT date_trunc('month', mes_producao)::date AS m,
               SUM(CASE WHEN status='cancelada' THEN COALESCE(valor_bem,0) END) AS canc,
               COUNT(*) FILTER (WHERE status='cancelada') AS qtd_canc,
               SUM(CASE WHEN status='inadimplente' THEN COALESCE(valor_bem,0) END) AS inad,
               COUNT(*) FILTER (WHERE status='inadimplente') AS qtd_inad
        FROM ult WHERE mes_producao IS NOT NULL GROUP BY 1
      ) agg ON agg.m = m.m;

      RETURN QUERY SELECT
        v_mes,
        v_ind,
        v_ini,
        v_fim,
        v_den,
        v_den_mcf,
        v_num,
        v_canc,
        v_inad,
        CASE WHEN v_den > 0 THEN v_num / v_den ELSE NULL END,
        COALESCE(v_qtd, 0),
        v_cfg.meta,
        v_falta,
        CASE WHEN v_falta > 0 AND COALESCE(v_medio,0) > 0
             THEN CEIL(v_falta / v_medio)::int ELSE 0 END,
        v_tem,
        v_break;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.embracon_indices_class(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.embracon_indices_class(date) TO authenticated;
