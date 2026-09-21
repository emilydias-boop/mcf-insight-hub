DROP FUNCTION IF EXISTS public.embracon_indices_class(date);

CREATE OR REPLACE FUNCTION public.embracon_indices_class(p_mes date, p_fonte text DEFAULT 'mcf')
 RETURNS TABLE(mes_apuracao date, indice text, janela_inicio date, janela_fim date, denominador numeric, denominador_mcf numeric, numerador numeric, numerador_canceladas numeric, numerador_inadimplentes numeric, indice_valor numeric, indice_valor_mcf numeric, indice_valor_oficial numeric, fonte text, qtd_cotas integer, meta numeric, falta_para_meta numeric, cotas_para_meta integer, tem_importacao boolean, breakdown jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg public.embracon_class_config;
  v_base date := date_trunc('month', p_mes)::date;
  v_fonte text := CASE WHEN lower(COALESCE(p_fonte,'mcf')) = 'power_bi' THEN 'power_bi' ELSE 'mcf' END;
  v_lote date;
  v_offset int;
  v_ind text;
  v_mes date;
  v_ini date;
  v_fim date;
  v_den numeric;
  v_den_mcf numeric;
  v_den_base numeric;
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

  -- Lote mais recente = fotografia completa da fonte Power BI. O relatorio lista
  -- apenas as cotas canceladas/inadimplentes do momento; cota reativada desaparece
  -- do relatorio seguinte. Lotes antigos seguem guardados, apenas nao entram no calculo.
  SELECT MAX(data_referencia) INTO v_lote FROM public.embracon_cota_status_import;
  v_tem := v_lote IS NOT NULL;

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

      -- denominador oficial (producao mensal lancada, planilha/Power BI)
      SELECT COALESCE(SUM(valor), 0) INTO v_den
      FROM public.embracon_producao_mensal
      WHERE mes >= v_ini AND mes <= v_fim;

      -- denominador do proprio sistema: SO cotas contratadas. Reserva nao efetivada
      -- nao e producao e por isso fica fora das duas pontas (numerador e denominador).
      SELECT COALESCE(SUM(c.valor_credito), 0) INTO v_den_mcf
      FROM public.consortium_cards c
      WHERE c.tipo_registro = 'contratacao'
        AND date_trunc('month', COALESCE(c.data_contratacao, c.data_reserva, c.created_at::date))::date
            BETWEEN v_ini AND v_fim;

      IF v_fonte = 'mcf' THEN
        -- Numerador pelos dados do MCF Gestao.
        -- cancelada = cota contratada com status 'cancelado' (o status e alterado na
        -- ficha da cota e fica registrado em consortium_card_activity_log). Se a cota
        -- voltar para 'ativo', ela sai naturalmente do numerador no proximo calculo.
        -- inadimplente (8-2) = cota nao cancelada com >= 1 parcela vencida e nao paga.
        WITH cotas AS (
          SELECT c.id, COALESCE(c.valor_credito,0) AS credito, c.status,
                 date_trunc('month', COALESCE(c.data_contratacao, c.data_reserva, c.created_at::date))::date AS m
          FROM public.consortium_cards c
          WHERE c.tipo_registro = 'contratacao'
            AND date_trunc('month', COALESCE(c.data_contratacao, c.data_reserva, c.created_at::date))::date
                BETWEEN v_ini AND v_fim
        ), atraso AS (
          SELECT DISTINCT i.card_id
          FROM public.consortium_installments i
          WHERE i.data_vencimento < CURRENT_DATE
            AND COALESCE(i.status,'') <> 'pago'
            AND i.data_pagamento IS NULL
        ), marc AS (
          SELECT k.*,
                 (k.status = 'cancelado') AS eh_canc,
                 (k.status <> 'cancelado' AND k.id IN (SELECT card_id FROM atraso)) AS eh_inad
          FROM cotas k
        )
        SELECT
          COALESCE(SUM(credito) FILTER (WHERE eh_canc), 0),
          COALESCE(SUM(credito) FILTER (WHERE eh_inad), 0),
          COUNT(*) FILTER (WHERE eh_canc OR (v_ind = '8-2' AND eh_inad)),
          AVG(NULLIF(credito,0)) FILTER (WHERE eh_canc)
        INTO v_canc, v_inad, v_qtd, v_medio
        FROM marc;

        IF v_ind = '12-6' THEN
          v_num := v_canc; v_inad := 0;
        ELSE
          v_num := v_canc + v_inad;
        END IF;

        v_den_base := v_den_mcf;
        v_falta := v_num - (v_cfg.meta * v_den_base);

        -- breakdown por mes de producao, tambem pelo MCF Gestao
        WITH meses AS (
          SELECT generate_series(v_ini, v_fim, interval '1 month')::date AS m
        ), atraso AS (
          SELECT DISTINCT i.card_id
          FROM public.consortium_installments i
          WHERE i.data_vencimento < CURRENT_DATE
            AND COALESCE(i.status,'') <> 'pago'
            AND i.data_pagamento IS NULL
        ), agg AS (
          SELECT date_trunc('month', COALESCE(c.data_contratacao, c.data_reserva, c.created_at::date))::date AS m,
                 SUM(COALESCE(c.valor_credito,0)) FILTER (WHERE c.status = 'cancelado') AS canc,
                 COUNT(*) FILTER (WHERE c.status = 'cancelado') AS qtd_canc,
                 SUM(COALESCE(c.valor_credito,0)) FILTER (WHERE c.status <> 'cancelado' AND c.id IN (SELECT card_id FROM atraso)) AS inad,
                 COUNT(*) FILTER (WHERE c.status <> 'cancelado' AND c.id IN (SELECT card_id FROM atraso)) AS qtd_inad,
                 SUM(COALESCE(c.valor_credito,0)) AS producao_mcf
          FROM public.consortium_cards c
          WHERE c.tipo_registro = 'contratacao'
          GROUP BY 1
        )
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'mes', m.m,
          'producao', COALESCE(pm.valor, 0),
          'producao_mcf', COALESCE(agg.producao_mcf, 0),
          'qtd_canceladas', COALESCE(agg.qtd_canc, 0),
          'credito_canceladas', COALESCE(agg.canc, 0),
          'qtd_inadimplentes', CASE WHEN v_ind = '8-2' THEN COALESCE(agg.qtd_inad, 0) ELSE 0 END,
          'credito_inadimplentes', CASE WHEN v_ind = '8-2' THEN COALESCE(agg.inad, 0) ELSE 0 END
        ) ORDER BY m.m), '[]'::jsonb)
        INTO v_break
        FROM meses m
        LEFT JOIN public.embracon_producao_mensal pm ON pm.mes = m.m
        LEFT JOIN agg ON agg.m = m.m;

      ELSE
        -- Fonte Power BI: inalterada. Lote mais recente como fotografia completa.
        IF NOT v_tem THEN
          v_canc := NULL; v_inad := NULL; v_num := NULL;
          v_qtd := NULL; v_medio := NULL; v_falta := NULL;
        ELSE
          WITH ult AS (
            SELECT DISTINCT ON (i.grupo, i.cota) i.*
            FROM public.embracon_cota_status_import i
            WHERE i.data_referencia = v_lote
            ORDER BY i.grupo, i.cota, i.importado_em DESC
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
            v_num := v_canc; v_inad := 0;
          ELSE
            v_num := v_canc + v_inad;
          END IF;

          v_falta := v_num - (v_cfg.meta * v_den);
        END IF;
        v_den_base := v_den;

        WITH ult AS (
          SELECT DISTINCT ON (i.grupo, i.cota) i.*
          FROM public.embracon_cota_status_import i
          WHERE v_tem AND i.data_referencia = v_lote
          ORDER BY i.grupo, i.cota, i.importado_em DESC
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
      END IF;

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
        CASE WHEN v_num IS NOT NULL AND COALESCE(v_den_base,0) > 0 THEN v_num / v_den_base ELSE NULL END,
        CASE WHEN v_num IS NOT NULL AND v_den_mcf > 0 THEN v_num / v_den_mcf ELSE NULL END,
        CASE WHEN v_num IS NOT NULL AND v_den > 0 THEN v_num / v_den ELSE NULL END,
        v_fonte,
        v_qtd,
        v_cfg.meta,
        v_falta,
        CASE WHEN COALESCE(v_falta,0) > 0 AND COALESCE(v_medio,0) > 0
             THEN CEIL(v_falta / v_medio)::int ELSE 0 END,
        v_tem,
        v_break;
    END LOOP;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.embracon_indices_class(date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.embracon_indices_class(date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.embracon_indices_class(date, text) TO service_role;