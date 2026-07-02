
-- Insert token for BU incorporador (idempotente)
INSERT INTO public.bi_public_tokens (token, bu, active)
SELECT 'i9f42a8c1de5b7c30a9e4b6d8f2103bc7e5a9', 'incorporador', true
WHERE NOT EXISTS (SELECT 1 FROM public.bi_public_tokens WHERE bu = 'incorporador');

CREATE OR REPLACE FUNCTION public.get_bi_public_incorporador(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valid BOOLEAN;
  v_tz TEXT := 'America/Sao_Paulo';
  v_today DATE := (now() AT TIME ZONE v_tz)::date;
  v_month_start DATE := date_trunc('month', v_today)::date;
  v_month_end DATE := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
  v_year_start DATE := date_trunc('year', v_today)::date;
  v_year_end DATE := (date_trunc('year', v_today) + interval '1 year - 1 day')::date;
  -- Semana Sáb→Sex: 6=Sat...5=Fri (extract dow: 0=dom..6=sáb)
  v_week_start DATE := v_today - ((EXTRACT(DOW FROM v_today)::int + 1) % 7);
  v_week_end DATE := v_week_start + 6;

  v_meta_semana NUMERIC := 0;
  v_meta_mes NUMERIC := 0;
  v_meta_ano NUMERIC := 0;
  v_apurado_semana NUMERIC := 0;
  v_apurado_mes NUMERIC := 0;
  v_apurado_ano NUMERIC := 0;
  v_apurado_hoje NUMERIC := 0;
  v_daily JSONB;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.bi_public_tokens
    WHERE token = _token AND bu = 'incorporador' AND active = true
  ) INTO v_valid;
  IF NOT v_valid THEN
    RETURN jsonb_build_object('error','invalid_token');
  END IF;

  SELECT COALESCE(MAX(CASE WHEN target_type='setor_incorporador_semana' THEN target_value END),0),
         COALESCE(MAX(CASE WHEN target_type='setor_incorporador_mes'    THEN target_value END),0),
         COALESCE(MAX(CASE WHEN target_type='setor_incorporador_ano'    THEN target_value END),0)
    INTO v_meta_semana, v_meta_mes, v_meta_ano
  FROM public.team_targets
  WHERE target_type IN ('setor_incorporador_semana','setor_incorporador_mes','setor_incorporador_ano');

  -- Transações "primeiras" do grupo cliente+produto (mesma regra do painel)
  WITH first_ids AS (
    SELECT id FROM public.get_first_transaction_ids()
  ),
  base AS (
    SELECT
      ht.id,
      ht.sale_date,
      (ht.sale_date AT TIME ZONE v_tz)::date AS d,
      ht.installment_number,
      ht.gross_override,
      ht.product_price,
      ht.product_name,
      COALESCE(
        public.get_effective_price(pc.id, ht.sale_date),
        pc.reference_price
      ) AS reference_price,
      (fi.id IS NOT NULL) AS is_first
    FROM public.hubla_transactions ht
    INNER JOIN public.product_configurations pc
      ON ht.product_name = pc.product_name
     AND pc.target_bu = 'incorporador'
     AND pc.is_active = true
    LEFT JOIN first_ids fi ON fi.id = ht.id
    WHERE ht.sale_status = 'completed'
      AND ht.hubla_id NOT ILIKE 'newsale-%'
      AND ht.source IN ('hubla','manual','make','mcfpay','kiwify')
      AND NOT (ht.source = 'make' AND ht.sale_date >= '2026-04-01T00:00:00-03:00'::timestamptz)
      AND (ht.sale_date AT TIME ZONE v_tz)::date BETWEEN v_year_start AND v_year_end
  ),
  gross AS (
    SELECT
      d,
      CASE
        WHEN COALESCE(installment_number,1) > 1 THEN 0
        WHEN gross_override IS NOT NULL THEN gross_override
        WHEN NOT is_first THEN 0
        WHEN LOWER(TRIM(product_name)) = 'parceria' THEN COALESCE(product_price,0)
        WHEN reference_price IS NOT NULL THEN reference_price
        ELSE COALESCE(product_price,0)
      END::numeric AS v
    FROM base
  )
  SELECT
    COALESCE(SUM(v),0),
    COALESCE(SUM(CASE WHEN d BETWEEN v_month_start AND v_month_end THEN v ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN d BETWEEN v_week_start AND v_week_end   THEN v ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN d = v_today THEN v ELSE 0 END),0)
    INTO v_apurado_ano, v_apurado_mes, v_apurado_semana, v_apurado_hoje
  FROM gross;

  WITH first_ids AS (
    SELECT id FROM public.get_first_transaction_ids()
  ),
  base AS (
    SELECT
      ht.id,
      (ht.sale_date AT TIME ZONE v_tz)::date AS d,
      ht.installment_number,
      ht.gross_override,
      ht.product_price,
      ht.product_name,
      COALESCE(
        public.get_effective_price(pc.id, ht.sale_date),
        pc.reference_price
      ) AS reference_price,
      (fi.id IS NOT NULL) AS is_first
    FROM public.hubla_transactions ht
    INNER JOIN public.product_configurations pc
      ON ht.product_name = pc.product_name
     AND pc.target_bu = 'incorporador'
     AND pc.is_active = true
    LEFT JOIN first_ids fi ON fi.id = ht.id
    WHERE ht.sale_status = 'completed'
      AND ht.hubla_id NOT ILIKE 'newsale-%'
      AND ht.source IN ('hubla','manual','make','mcfpay','kiwify')
      AND NOT (ht.source = 'make' AND ht.sale_date >= '2026-04-01T00:00:00-03:00'::timestamptz)
      AND (ht.sale_date AT TIME ZONE v_tz)::date BETWEEN v_month_start AND v_month_end
  ),
  daily AS (
    SELECT d, SUM(
      CASE
        WHEN COALESCE(installment_number,1) > 1 THEN 0
        WHEN gross_override IS NOT NULL THEN gross_override
        WHEN NOT is_first THEN 0
        WHEN LOWER(TRIM(product_name)) = 'parceria' THEN COALESCE(product_price,0)
        WHEN reference_price IS NOT NULL THEN reference_price
        ELSE COALESCE(product_price,0)
      END
    )::numeric AS v
    FROM base
    GROUP BY d
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('d', to_char(d,'YYYY-MM-DD'), 'v', v) ORDER BY d), '[]'::jsonb)
    INTO v_daily
  FROM daily;

  RETURN jsonb_build_object(
    'month_ref', v_month_start,
    'today', v_today,
    'week_start', v_week_start,
    'week_end', v_week_end,
    'meta_semana', v_meta_semana,
    'meta_mes', v_meta_mes,
    'meta_ano', v_meta_ano,
    'apurado_semana', v_apurado_semana,
    'apurado_mes', v_apurado_mes,
    'apurado_ano', v_apurado_ano,
    'apurado_hoje', v_apurado_hoje,
    'daily', v_daily
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_bi_public_incorporador(text) TO anon, authenticated;
