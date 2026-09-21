CREATE OR REPLACE FUNCTION public.embracon_indices_class(p_mes date)
 RETURNS TABLE(mes_apuracao date, indice text, janela_inicio date, janela_fim date, denominador numeric, denominador_mcf numeric, numerador numeric, numerador_canceladas numeric, numerador_inadimplentes numeric, indice_valor numeric, qtd_cotas integer, meta numeric, falta_para_meta numeric, cotas_para_meta integer, tem_importacao boolean, breakdown jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg public.embracon_class_config;
  v_base date := date_trunc('month', p_mes)::date;
  v_lote date;
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

  -- Lote mais recente = fotografia completa. O relatorio do Power BI lista apenas
  -- as cotas canceladas/inadimplentes do momento; uma cota reativada simplesmente
  -- desaparece do relatorio seguinte. Por isso o calculo considera SO as linhas da
  -- maior data_referencia: cota ausente no lote mais recente nao entra no numerador.
  -- Lotes antigos seguem guardados (insert-only), apenas nao entram no calculo.
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

      -- denominador oficial (producao mensal lancada)
      SELECT COALESCE(SUM(valor), 0) INTO v_den
      FROM public.embracon_producao_mensal
      WHERE mes >= v_ini AND mes <= v_fim;

      -- denominador alternativo: cotas do MCF Gestao na mesma janela
      SELECT COALESCE(SUM(c.valor_credito), 0) INTO v_den_mcf
      FROM public.consortium_cards c
      WHERE date_trunc('month', COALESCE(c.data_contratacao, c.data_reserva, c.created_at::date))::date
            BETWEEN v_ini AND v_fim;

      IF NOT v_tem THEN
        -- Sem importacao nao ha numerador: devolve NULL, nunca zero.
        v_canc := NULL; v_inad := NULL; v_num := NULL;
        v_qtd := NULL; v_medio := NULL; v_falta := NULL;
      ELSE
        -- lote mais recente, deduplicado por grupo/cota
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
          v_num := v_canc;
          v_inad := 0;
        ELSE
          v_num := v_canc + v_inad;
        END IF;

        v_falta := v_num - (v_cfg.meta * v_den);
      END IF;

      -- numerador aberto por mes de producao (mesmo lote mais recente)
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
        CASE WHEN v_tem AND v_den > 0 THEN v_num / v_den ELSE NULL END,
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

REVOKE ALL ON FUNCTION public.embracon_indices_class(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.embracon_indices_class(date) TO authenticated;