DO $mig$
DECLARE src text; novo text;
BEGIN
  SELECT pg_get_functiondef('public.relatorio_diario_operacoes(date)'::regprocedure) INTO src;
  novo := replace(src,
$a$  SELECT count(*) INTO i_vd_m FROM public.deal_activities da
  WHERE da.to_stage = 'Venda realizada' AND da.created_at >= v_t0m AND da.created_at < v_t1;$a$,
$b$  -- Vendas realizadas = vendas únicas de high ticket (A001/A009) por cliente+produto, pela data da venda
  SELECT count(*), count(*) FILTER (WHERE x.primeira >= v_t0d) INTO i_vd_m, i_vd_d
  FROM (
    SELECT lower(btrim(t.customer_email)) AS cliente, upper(left(btrim(t.product_name),4)) AS prod, min(t.sale_date) AS primeira
    FROM public.hubla_transactions t
    WHERE t.sale_status = 'completed'
      AND (t.product_name ILIKE 'A001%' OR t.product_name ILIKE 'A009%')
      AND t.sale_date >= v_t0m AND t.sale_date < v_t1
      AND COALESCE(btrim(t.customer_email),'') <> ''
    GROUP BY 1, 2
  ) x;$b$);
  novo := replace(novo,
    $c$'vendas_realizadas', public._rdo_m((d_inc->>'venda_realizada')::numeric, i_vd_m,$c$,
    $d$'vendas_realizadas', public._rdo_m(i_vd_d, i_vd_m,$d$);
  novo := replace(novo, 'i_vd_m numeric; i_fat_m numeric;', 'i_vd_m numeric; i_vd_d numeric; i_fat_m numeric;');
  IF novo = src OR position('i_vd_d, i_vd_m' in novo) = 0 OR position('A001%' in novo) = 0 THEN
    RAISE EXCEPTION 'trecho esperado não encontrado; nada alterado';
  END IF;
  EXECUTE novo;
END $mig$;