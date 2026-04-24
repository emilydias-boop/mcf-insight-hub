CREATE OR REPLACE FUNCTION public.get_channel_funnel_metrics(
  start_date text,
  end_date text,
  bu_filter text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE result JSON;
BEGIN
  WITH a010_purchases AS (
    SELECT
      LOWER(TRIM(customer_email)) AS email,
      MIN(sale_date) AS first_a010_purchase
    FROM hubla_transactions
    WHERE product_name ILIKE '%A010%'
      AND sale_status = 'completed'
      AND customer_email IS NOT NULL
      AND sale_date >= (start_date::date - INTERVAL '24 months')
    GROUP BY LOWER(TRIM(customer_email))
  ),
  deal_signals AS (
    SELECT
      d.id AS deal_id,
      d.created_at,
      d.origin_id,
      LOWER(TRIM(c.email)) AS email,
      EXISTS (
        SELECT 1 FROM unnest(COALESCE(d.tags, ARRAY[]::text[])) AS t(val)
        WHERE UPPER(t.val) LIKE '%A010%'
      ) AS has_a010_tag,
      (
        EXISTS (
          SELECT 1 FROM unnest(COALESCE(d.tags, ARRAY[]::text[])) AS t(val)
          WHERE UPPER(t.val) ~ '(ANAMNESE|LIVE|LAN[CÇ]AMENTO)'
            AND UPPER(t.val) NOT LIKE '%INCOMPLET%'
        )
        OR (
          UPPER(COALESCE(o.name, '')) ~ '(ANAMNESE|LIVE|LAN[CÇ]AMENTO)'
          AND UPPER(COALESCE(o.name, '')) NOT LIKE '%INCOMPLET%'
        )
        OR (
          UPPER(COALESCE(d.custom_fields->>'lead_channel', '')) ~ '(ANAMNESE|LIVE|LAN[CÇ]AMENTO)'
          AND UPPER(COALESCE(d.custom_fields->>'lead_channel', '')) NOT LIKE '%INCOMPLET%'
        )
      ) AS has_anamnese_signal,
      (
        UPPER(COALESCE(o.name, '')) LIKE '%A010%'
        OR UPPER(COALESCE(d.custom_fields->>'lead_channel', '')) LIKE '%A010%'
      ) AS has_a010_origin
    FROM crm_deals d
    LEFT JOIN crm_origins o ON o.id = d.origin_id
    LEFT JOIN crm_contacts c ON c.id = d.contact_id
  ),
  deal_channels AS (
    SELECT
      ds.deal_id,
      ds.created_at,
      ds.origin_id,
      CASE
        WHEN ap.first_a010_purchase IS NOT NULL
          AND (ds.created_at - ap.first_a010_purchase) <= INTERVAL '30 days'
          AND (ds.created_at - ap.first_a010_purchase) >= INTERVAL '-1 days'
        THEN 'A010'
        WHEN ds.has_anamnese_signal
        THEN 'ANAMNESE'
        WHEN ap.first_a010_purchase IS NOT NULL
          AND (ds.created_at - ap.first_a010_purchase) > INTERVAL '30 days'
        THEN 'ANAMNESE'
        WHEN ds.has_a010_tag OR ds.has_a010_origin
        THEN 'A010'
        ELSE 'OUTROS'
      END AS channel
    FROM deal_signals ds
    LEFT JOIN a010_purchases ap ON ap.email = ds.email
  ),
  raw_attendees AS (
    SELECT
      msa.deal_id,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS meeting_day,
      (COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo')::date AS booked_day,
      msa.status,
      msa.contract_paid_at,
      COALESCE(msa.booked_at, msa.created_at) AS effective_booked_at,
      sdr_at_time.squad AS sdr_squad_at_booking,
      cl.bu AS closer_bu
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN closers cl ON cl.id = ms.closer_id
    LEFT JOIN profiles p_booker ON p_booker.id = msa.booked_by
    LEFT JOIN LATERAL (
      SELECT s.id, h.squad
      FROM public.sdr s
      INNER JOIN public.sdr_squad_history h ON h.sdr_id = s.id
      WHERE LOWER(s.email) = LOWER(p_booker.email)
        AND h.valid_from <= COALESCE(msa.booked_at, msa.created_at)
        AND COALESCE(h.valid_to, 'infinity'::timestamptz) > COALESCE(msa.booked_at, msa.created_at)
      ORDER BY h.valid_from DESC
      LIMIT 1
    ) sdr_at_time ON true
    WHERE msa.status != 'cancelled'
      AND ms.meeting_type = 'r1'
      AND msa.is_partner = false
      AND p_booker.email IS NOT NULL
      AND msa.deal_id IS NOT NULL
      AND (
        bu_filter IS NULL
        OR sdr_at_time.squad = bu_filter
        OR (sdr_at_time.squad IS NULL AND cl.bu = bu_filter)
      )
  ),
  attendee_with_channel AS (
    SELECT ra.*, COALESCE(dc.channel, 'OUTROS') AS channel
    FROM raw_attendees ra
    LEFT JOIN deal_channels dc ON dc.deal_id = ra.deal_id
  ),
  dedup_agendada AS (
    SELECT channel, deal_id,
      LEAST(COUNT(DISTINCT booked_day), 2) AS agendada_count,
      MAX(CASE WHEN status IN ('completed','contract_paid','refunded') THEN 1 ELSE 0 END) AS realized,
      MAX(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS is_noshow
    FROM attendee_with_channel
    WHERE booked_day BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY channel, deal_id
  ),
  funnel_agg AS (
    SELECT channel,
      SUM(agendada_count)::int AS r1_agendada,
      SUM(realized)::int AS r1_realizada,
      SUM(is_noshow)::int AS no_shows
    FROM dedup_agendada
    GROUP BY channel
  ),
  contratos_cte AS (
    SELECT channel, COUNT(*)::int AS contratos
    FROM attendee_with_channel
    WHERE (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY channel
  ),
  bu_origins AS (
    SELECT DISTINCT bom.entity_id::uuid AS origin_id
    FROM bu_origin_mapping bom
    WHERE bu_filter IS NOT NULL
      AND bom.bu = bu_filter
      AND bom.entity_type = 'origin'
  ),
  entradas_cte AS (
    SELECT dc.channel, COUNT(*)::int AS entradas
    FROM deal_channels dc
    WHERE dc.created_at BETWEEN start_date::timestamptz AND (end_date::date + 1)::timestamptz
      AND (
        bu_filter IS NULL
        OR dc.origin_id IN (SELECT origin_id FROM bu_origins)
      )
    GROUP BY dc.channel
  ),
  channel_universe AS (
    SELECT 'A010'::text AS channel UNION ALL
    SELECT 'ANAMNESE' UNION ALL
    SELECT 'OUTROS'
  )
  SELECT json_build_object(
    'channels', COALESCE(json_agg(
      json_build_object(
        'channel', cu.channel,
        'entradas', COALESCE(e.entradas, 0),
        'r1_agendada', COALESCE(f.r1_agendada, 0),
        'r1_realizada', COALESCE(f.r1_realizada, 0),
        'no_shows', COALESCE(f.no_shows, 0),
        'contratos', COALESCE(c.contratos, 0)
      ) ORDER BY cu.channel
    ), '[]'::json)
  ) INTO result
  FROM channel_universe cu
  LEFT JOIN funnel_agg f ON f.channel = cu.channel
  LEFT JOIN contratos_cte c ON c.channel = cu.channel
  LEFT JOIN entradas_cte e ON e.channel = cu.channel;

  RETURN COALESCE(result, json_build_object('channels', '[]'::json));
END;
$function$;