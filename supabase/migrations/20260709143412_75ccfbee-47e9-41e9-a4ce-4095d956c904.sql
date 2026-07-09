
CREATE OR REPLACE FUNCTION public.get_bi_incorporador_weekly_rankings(_month_ref date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tz text := 'America/Sao_Paulo';
  v_today date := (now() AT TIME ZONE v_tz)::date;
  v_month_start date := COALESCE(date_trunc('month', _month_ref)::date, date_trunc('month', v_today)::date);
  v_month_end date := (v_month_start + interval '1 month - 1 day')::date;
  v_lookback_start timestamptz := (v_month_start - interval '60 days')::timestamptz;
  v_lookback_end timestamptz := ((v_month_end + interval '1 day')::timestamptz);
  v_result jsonb;
BEGIN
  WITH first_ids AS (
    SELECT id FROM public.get_first_transaction_ids()
  ),
  base AS (
    SELECT
      ht.id,
      (ht.sale_date AT TIME ZONE v_tz)::date AS d,
      ht.sale_date,
      ht.sale_status,
      ht.installment_number,
      ht.gross_override,
      ht.product_price,
      ht.product_name,
      ht.linked_attendee_id,
      LOWER(TRIM(ht.customer_email)) AS email_norm,
      RIGHT(REGEXP_REPLACE(COALESCE(ht.customer_phone,''), '\D', '', 'g'), 9) AS phone9,
      COALESCE(public.get_effective_price(pc.id, ht.sale_date), pc.reference_price) AS reference_price,
      (fi.id IS NOT NULL) AS is_first
    FROM public.hubla_transactions ht
    LEFT JOIN public.product_configurations pc
      ON ht.product_name = pc.product_name
     AND pc.target_bu = 'incorporador'
     AND pc.is_active = true
    LEFT JOIN first_ids fi ON fi.id = ht.id
    WHERE ht.sale_status IN ('completed','refunded')
      AND ht.hubla_id NOT ILIKE 'newsale-%'
      AND ht.source IN ('hubla','manual','make','mcfpay','kiwify')
      AND NOT (ht.source = 'make' AND ht.sale_date >= '2026-04-01T00:00:00-03:00'::timestamptz)
      AND ht.product_category = 'contrato'
      AND (ht.sale_date AT TIME ZONE v_tz)::date BETWEEN v_month_start AND v_month_end
  ),
  txn AS (
    SELECT
      b.*,
      (b.d - (((EXTRACT(DOW FROM b.d)::int + 1) % 7)))::date AS week_start,
      CASE
        WHEN COALESCE(b.installment_number,1) > 1 THEN 0
        WHEN b.gross_override IS NOT NULL THEN b.gross_override
        WHEN NOT b.is_first THEN 0
        WHEN b.reference_price IS NOT NULL THEN b.reference_price
        ELSE COALESCE(b.product_price,0)
      END::numeric AS gross_v
    FROM base b
  ),
  r1_att AS (
    SELECT
      msa.id AS attendee_id,
      msa.booked_by AS sdr_id,
      ms.closer_id AS closer_id,
      ms.scheduled_at,
      LOWER(TRIM(cc.email)) AS email_norm,
      RIGHT(REGEXP_REPLACE(COALESCE(cc.phone, msa.attendee_phone, ''), '\D', '', 'g'), 9) AS phone9
    FROM public.meeting_slot_attendees msa
    INNER JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN public.crm_deals cd ON cd.id = msa.deal_id
    LEFT JOIN public.crm_contacts cc ON cc.id = cd.contact_id
    WHERE ms.meeting_type = 'r1'
      AND ms.scheduled_at >= v_lookback_start
      AND ms.scheduled_at < v_lookback_end
  ),
  direct_link AS (
    SELECT t.id AS tx_id, r.sdr_id, r.closer_id
    FROM txn t
    JOIN r1_att r ON r.attendee_id = t.linked_attendee_id
  ),
  email_match AS (
    SELECT DISTINCT ON (t.id) t.id AS tx_id, r.sdr_id, r.closer_id
    FROM txn t
    JOIN r1_att r ON r.email_norm = t.email_norm AND COALESCE(t.email_norm,'') <> ''
    WHERE r.scheduled_at <= (t.sale_date + interval '1 day')
    ORDER BY t.id, r.scheduled_at DESC
  ),
  phone_match AS (
    SELECT DISTINCT ON (t.id) t.id AS tx_id, r.sdr_id, r.closer_id
    FROM txn t
    JOIN r1_att r ON r.phone9 = t.phone9 AND length(t.phone9) >= 8
    WHERE r.scheduled_at <= (t.sale_date + interval '1 day')
    ORDER BY t.id, r.scheduled_at DESC
  ),
  attribution AS (
    SELECT
      t.id AS tx_id,
      COALESCE(d.sdr_id, em.sdr_id, pm.sdr_id) AS sdr_id,
      COALESCE(d.closer_id, em.closer_id, pm.closer_id) AS closer_id
    FROM txn t
    LEFT JOIN direct_link d ON d.tx_id = t.id
    LEFT JOIN email_match em ON em.tx_id = t.id
    LEFT JOIN phone_match pm ON pm.tx_id = t.id
  ),
  enriched AS (
    SELECT t.*, a.sdr_id, a.closer_id
    FROM txn t
    LEFT JOIN attribution a ON a.tx_id = t.id
  ),
  weeks AS (
    SELECT DISTINCT week_start FROM enriched
  ),
  totals AS (
    SELECT
      week_start,
      COALESCE(SUM(CASE WHEN sale_status = 'completed' THEN gross_v ELSE 0 END),0) AS vendas_valor,
      COUNT(*) FILTER (WHERE sale_status = 'completed' AND gross_v > 0) AS vendas_qtd,
      COALESCE(SUM(CASE WHEN sale_status = 'refunded' THEN gross_v ELSE 0 END),0) AS reembolsos_valor,
      COUNT(*) FILTER (WHERE sale_status = 'refunded' AND gross_v > 0) AS reembolsos_qtd
    FROM enriched
    GROUP BY week_start
  ),
  sdr_agg AS (
    SELECT
      e.week_start,
      e.sdr_id,
      COALESCE(p.full_name, p.email, 'Sem SDR') AS sdr_name,
      COUNT(*) FILTER (WHERE e.sale_status = 'completed' AND e.gross_v > 0) AS contratos,
      COALESCE(SUM(CASE WHEN e.sale_status='completed' THEN e.gross_v ELSE 0 END),0) AS valor
    FROM enriched e
    LEFT JOIN public.profiles p ON p.id = e.sdr_id
    WHERE e.sdr_id IS NOT NULL
    GROUP BY e.week_start, e.sdr_id, p.full_name, p.email
  ),
  sdr_ranked AS (
    SELECT week_start,
      jsonb_agg(jsonb_build_object(
        'sdr_id', sdr_id, 'name', sdr_name, 'contratos', contratos, 'valor', valor
      ) ORDER BY contratos DESC, valor DESC) AS lst
    FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY week_start ORDER BY contratos DESC, valor DESC) rn
      FROM sdr_agg WHERE contratos > 0
    ) s WHERE rn <= 5
    GROUP BY week_start
  ),
  closer_agg AS (
    SELECT
      e.week_start,
      e.closer_id,
      COALESCE(c.name, 'Sem Closer') AS closer_name,
      COUNT(*) FILTER (WHERE e.sale_status = 'completed' AND e.gross_v > 0) AS contratos,
      COALESCE(SUM(CASE WHEN e.sale_status='completed' THEN e.gross_v ELSE 0 END),0) AS valor
    FROM enriched e
    LEFT JOIN public.closers c ON c.id = e.closer_id
    WHERE e.closer_id IS NOT NULL
    GROUP BY e.week_start, e.closer_id, c.name
  ),
  closer_ranked AS (
    SELECT week_start,
      jsonb_agg(jsonb_build_object(
        'closer_id', closer_id, 'name', closer_name, 'contratos', contratos, 'valor', valor
      ) ORDER BY contratos DESC, valor DESC) AS lst
    FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY week_start ORDER BY contratos DESC, valor DESC) rn
      FROM closer_agg WHERE contratos > 0
    ) c WHERE rn <= 3
    GROUP BY week_start
  )
  SELECT jsonb_build_object(
    'month_ref', v_month_start,
    'weeks', COALESCE(jsonb_agg(jsonb_build_object(
      'week_start', to_char(w.week_start,'YYYY-MM-DD'),
      'vendas_valor', COALESCE(t.vendas_valor,0),
      'vendas_qtd', COALESCE(t.vendas_qtd,0),
      'reembolsos_valor', COALESCE(t.reembolsos_valor,0),
      'reembolsos_qtd', COALESCE(t.reembolsos_qtd,0),
      'saldo', COALESCE(t.vendas_valor,0) - COALESCE(t.reembolsos_valor,0),
      'top_sdrs', COALESCE(sr.lst, '[]'::jsonb),
      'top_closers', COALESCE(cr.lst, '[]'::jsonb)
    ) ORDER BY w.week_start), '[]'::jsonb)
  ) INTO v_result
  FROM weeks w
  LEFT JOIN totals t ON t.week_start = w.week_start
  LEFT JOIN sdr_ranked sr ON sr.week_start = w.week_start
  LEFT JOIN closer_ranked cr ON cr.week_start = w.week_start;

  RETURN COALESCE(v_result, jsonb_build_object('month_ref', v_month_start, 'weeks', '[]'::jsonb));
END;
$$;
