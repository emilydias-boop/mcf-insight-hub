-- =====================================================================
-- Painel de metas do app iPhone "MCF Gestão" (aba Painel).
-- Só leitura. Números apurados = os mesmos do Resumo (resumo_app_v2).
-- Metas = as que JÁ existem no sistema (decisão do Grimaldo, 16/11/2026):
--   Contratos (Incorporador): ceo_metas.contratos_dia_util × dias úteis do período (régua do Painel do CEO).
--   Produção Gerada (Consórcio): consorcio_bi_metas.meta_valor do mês (BI Consórcio). Dia e semana:
--       meta do mês ÷ dias úteis do mês (ou dias_uteis_override) × dias úteis do período.
--   Crédito contratado (Consórcio): team_targets setor_efeito_alavanca_mes / _semana (valor fixo). Sem meta de dia.
--   Vendas Realizadas (Incorporador) e Cotas Contratadas (Consórcio): sem meta no sistema (meta = null).
-- Dias úteis: mesmo calendário do site (src/lib/businessDays.ts): seg a sex, menos os feriados
-- nacionais fixos (01-01, 04-21, 05-01, 09-07, 10-12, 11-02, 11-15, 12-25) e os móveis
-- (segunda e terça de Carnaval, Sexta-feira Santa, Corpus Christi).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.app_pascoa(p_ano int)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mes int; dia int;
BEGIN
  -- algoritmo de Meeus/Jones/Butcher (o mesmo do site)
  a := p_ano % 19; b := p_ano / 100; c := p_ano % 100; d := b / 4; e := b % 4;
  f := (b + 8) / 25; g := (b - f + 1) / 3; h := (19 * a + b - d - g + 15) % 30;
  i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  mes := (h + l - 7 * m + 114) / 31;
  dia := ((h + l - 7 * m + 114) % 31) + 1;
  RETURN make_date(p_ano, mes, dia);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_dias_uteis(p_ini date, p_fim date)
RETURNS int
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $function$
  SELECT count(*)::int
  FROM generate_series(p_ini, p_fim, interval '1 day') AS g(d)
  WHERE extract(isodow FROM g.d) < 6
    AND to_char(g.d, 'MM-DD') NOT IN ('01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25')
    AND g.d::date NOT IN (
      public.app_pascoa(extract(year FROM g.d)::int) - 2,   -- Sexta-feira Santa
      public.app_pascoa(extract(year FROM g.d)::int) - 47,  -- terça de Carnaval
      public.app_pascoa(extract(year FROM g.d)::int) - 48,  -- segunda de Carnaval
      public.app_pascoa(extract(year FROM g.d)::int) + 60   -- Corpus Christi
    );
$function$;

CREATE OR REPLACE FUNCTION public.painel_app_metas(p_preset text DEFAULT 'mes')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_preset text := lower(coalesce(p_preset, 'mes'));
  v_res jsonb;
  v_bu jsonb;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_mes_ini date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_mes_fim date := (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 month - 1 day')::date;
  v_ini date; v_fim date;
  v_du_periodo int;
  v_setores jsonb := '[]'::jsonb;
  v_itens jsonb;
  v_metas jsonb;
  -- metas
  v_contratos_dia numeric;
  v_bi_meta numeric; v_bi_override jsonb; v_du_mes_bi int; v_du_periodo_bi int;
  v_ea_mes numeric; v_ea_semana numeric;
  m_contratos numeric; m_producao numeric; m_credito numeric;
BEGIN
  IF v_preset NOT IN ('hoje','semana','mes') THEN
    RAISE EXCEPTION 'preset_invalido' USING ERRCODE = '22023';
  END IF;

  -- Apurado: o mesmo do Resumo (segurança, papel e BUs vêm dele: sem login ou sem papel comercial dá erro).
  v_res := public.resumo_app_v2(v_preset, NULL, NULL);

  -- Metas existentes
  SELECT cm.valor INTO v_contratos_dia FROM ceo_metas cm WHERE cm.chave = 'contratos_dia_util';
  SELECT bm.meta_valor, bm.dias_uteis_override INTO v_bi_meta, v_bi_override
    FROM consorcio_bi_metas bm WHERE bm.month_ref = v_mes_ini;
  SELECT max(tt.target_value) FILTER (WHERE tt.target_type = 'setor_efeito_alavanca_mes'),
         max(tt.target_value) FILTER (WHERE tt.target_type = 'setor_efeito_alavanca_semana')
    INTO v_ea_mes, v_ea_semana
    FROM team_targets tt
   WHERE tt.target_type IN ('setor_efeito_alavanca_mes','setor_efeito_alavanca_semana');

  FOR v_bu IN SELECT x FROM jsonb_array_elements(coalesce(v_res->'bus', '[]'::jsonb)) AS t(x) LOOP
    v_ini := (v_bu->'periodo'->>'ini')::date;
    v_fim := (v_bu->'periodo'->>'fim')::date;
    v_du_periodo := public.app_dias_uteis(v_ini, v_fim);
    -- métricas do Resumo indexadas pela chave
    SELECT coalesce(jsonb_object_agg(mt->>'chave', mt), '{}'::jsonb) INTO v_metas
      FROM jsonb_array_elements(coalesce(v_bu->'metricas', '[]'::jsonb)) AS q(mt);

    IF v_bu->>'bu' = 'incorporador' THEN
      m_contratos := CASE WHEN v_contratos_dia IS NULL OR v_du_periodo = 0 THEN NULL ELSE v_contratos_dia * v_du_periodo END;
      v_itens := jsonb_build_array(
        jsonb_build_object('chave','contratos','rotulo','Contratos','formato','int',
          'apurado', v_metas->'contratos'->'global',
          'meta', m_contratos,
          'ajuda', format('Meta do Painel do CEO: %s por dia útil × %s dias úteis no período.', coalesce(v_contratos_dia::text,'—'), v_du_periodo)),
        jsonb_build_object('chave','vendas_realizadas','rotulo','Vendas Realizadas','formato','int',
          'apurado', v_metas->'vendas_realizadas'->'global',
          'meta', NULL,
          'ajuda', 'High Ticket únicas (A001/A009) na Hubla. O sistema não tem meta cadastrada para esta régua.')
      );
    ELSIF v_bu->>'bu' = 'consorcio' THEN
      -- dias úteis considerados pelo BI no mês: lista manual (dias_uteis_override) ou o calendário padrão
      IF jsonb_typeof(v_bi_override) = 'array' AND jsonb_array_length(v_bi_override) > 0 THEN
        SELECT count(*)::int INTO v_du_mes_bi FROM jsonb_array_elements_text(v_bi_override) AS o(d);
        SELECT count(*)::int INTO v_du_periodo_bi FROM jsonb_array_elements_text(v_bi_override) AS o(d)
          WHERE o.d::date BETWEEN v_ini AND v_fim;
      ELSE
        v_du_mes_bi := public.app_dias_uteis(v_mes_ini, v_mes_fim);
        v_du_periodo_bi := public.app_dias_uteis(GREATEST(v_ini, v_mes_ini), LEAST(v_fim, v_mes_fim));
      END IF;
      m_producao := CASE
        WHEN v_bi_meta IS NULL THEN NULL
        WHEN v_preset = 'mes' THEN v_bi_meta
        WHEN coalesce(v_du_mes_bi, 0) = 0 OR coalesce(v_du_periodo_bi, 0) = 0 THEN NULL
        ELSE round(v_bi_meta / v_du_mes_bi * v_du_periodo_bi, 2) END;
      m_credito := CASE v_preset WHEN 'mes' THEN v_ea_mes WHEN 'semana' THEN v_ea_semana ELSE NULL END;
      v_itens := jsonb_build_array(
        jsonb_build_object('chave','producao_gerada','rotulo','Produção Gerada','formato','brl',
          'apurado', v_metas->'producao_gerada'->'global',
          'meta', m_producao,
          'ajuda', 'Meta mensal do BI Consórcio; no dia e na semana, proporcional aos dias úteis.'),
        jsonb_build_object('chave','cotas_contratadas','rotulo','Cotas contratadas','formato','int',
          'apurado', v_metas->'cotas_contratadas'->'global',
          'meta', NULL,
          'ajuda', 'O sistema não tem meta de cotas contratadas.'),
        jsonb_build_object('chave','credito_contratado','rotulo','Crédito contratado','formato','brl',
          'apurado', v_metas->'credito_contratado'->'global',
          'meta', m_credito,
          'ajuda', 'Meta Efeito Alavanca (valor em carta), fixa por mês e por semana. Não há meta diária.')
      );
    ELSE
      CONTINUE;
    END IF;

    v_setores := v_setores || jsonb_build_object(
      'bu', v_bu->>'bu', 'titulo', v_bu->>'titulo', 'periodo', v_bu->'periodo', 'itens', v_itens);
  END LOOP;

  RETURN jsonb_build_object(
    'periodo', (SELECT s->'periodo' FROM jsonb_array_elements(v_setores) AS s LIMIT 1),
    'setores', v_setores);
END;
$function$;

REVOKE ALL ON FUNCTION public.painel_app_metas(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painel_app_metas(text) TO authenticated;
REVOKE ALL ON FUNCTION public.app_dias_uteis(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_dias_uteis(date, date) TO authenticated;
REVOKE ALL ON FUNCTION public.app_pascoa(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_pascoa(int) TO authenticated;

COMMENT ON FUNCTION public.painel_app_metas(text) IS
  'App MCF Gestão (iPhone), aba Painel: apurado (= resumo_app_v2) contra as metas já existentes (ceo_metas, consorcio_bi_metas, setor_efeito_alavanca). Só leitura.';