CREATE OR REPLACE FUNCTION public.get_channel_funnel_metrics(
  start_date text,
  end_date text,
  bu_filter text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE result JSON;
BEGIN
  WITH deal_channels AS (
    SELECT
      d.id AS deal_id,
      CASE
        WHEN UPPER(COALESCE(o.name,'')) LIKE '%A010%'
          OR UPPER(COALESCE(d.custom_fields->>'lead_channel','')) LIKE '%A010%'
          OR EXISTS (
            SELECT 1 FROM unnest(COALESCE(d.tags, ARRAY[]::text[])) AS t(val)
            WHERE UPPER(t.val) LIKE '%A010%'
          )
        THEN 'A010'
        WHEN UPPER(COALESCE(o.name,'')) ~ '(ANAMNESE|LIVE|LAN[CÇ]AMENTO)'
          OR UPPER(COALESCE(d.custom_fields->>'lead_channel','')) ~ '(ANAMNESE|LIVE|LAN[CÇ]AMENTO)'
          OR EXISTS (
            SELECT 1 FROM unnest(COALESCE(d.tags, ARRAY[]::text[])) AS t(val)
            WHERE UPPER(t.val) ~ '(ANAMNESE|LIVE|LAN[CÇ]AMENTO)'
          )
        THEN 'ANAMNESE'
        ELSE 'OUTROS'
      END AS channel,
      d.created_at,
      d.origin_id
    FROM crm_deals d
    LEFT JOIN crm_origins o ON o.id = d.origin_id
  ),
  raw_attendees AS (
    SELECT
      msa.deal_id,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS meeting_day,
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
      LEAST(COUNT(DISTINCT meeting_day), 2) AS agendada_count,
      MAX(CASE WHEN status IN ('completed','contract_paid','refunded') THEN 1 ELSE 0 END) AS realized,
      MAX(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS is_noshow
    FROM attendee_with_channel
    WHERE meeting_day BETWEEN start_date::DATE AND end_date::DATE
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
    SELECT DISTINCT bpm.origin_id
    FROM bu_pipeline_map bpm
    WHERE bu_filter IS NOT NULL AND bpm.bu = bu_filter
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