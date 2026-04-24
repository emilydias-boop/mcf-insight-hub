-- Fix: dedup contratos by deal_id to prevent counting the same sale twice
-- when multiple attendees of the same deal are marked as contract_paid.
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL::text,
  bu_filter text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE result JSON;
BEGIN
  WITH raw_attendees AS (
    SELECT
      p_booker.email as sdr_email,
      COALESCE(p_booker.full_name, p_booker.email) as sdr_name,
      msa.deal_id,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date as meeting_day,
      msa.status,
      msa.contract_paid_at,
      COALESCE(msa.booked_at, msa.created_at) as effective_booked_at,
      sdr_at_time.id as sdr_id_at_booking,
      sdr_at_time.squad as sdr_squad_at_booking
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
      AND (sdr_email_filter IS NULL OR p_booker.email = sdr_email_filter)
      AND (
        bu_filter IS NULL
        OR sdr_at_time.squad = bu_filter
        OR (sdr_at_time.squad IS NULL AND cl.bu = bu_filter)
      )
      AND p_booker.email IS NOT NULL
  ),
  ranked_movements AS (
    SELECT
      sdr_email,
      sdr_name,
      deal_id,
      effective_booked_at,
      meeting_day,
      status,
      contract_paid_at,
      ROW_NUMBER() OVER (
        PARTITION BY deal_id
        ORDER BY effective_booked_at, meeting_day
      ) as ordem
    FROM raw_attendees
  ),
  dedup_agendada AS (
    SELECT sdr_email, sdr_name, deal_id,
      LEAST(COUNT(DISTINCT meeting_day), 2) as agendada_count,
      MAX(CASE WHEN status IN ('completed','contract_paid','refunded') THEN 1 ELSE 0 END) as realized,
      MAX(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as is_noshow
    FROM raw_attendees
    WHERE meeting_day BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY sdr_email, sdr_name, deal_id
  ),
  agendamentos_cte AS (
    SELECT sdr_email,
      COUNT(*) as agendamentos
    FROM ranked_movements
    WHERE ordem <= 2
      AND (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY sdr_email
  ),
  -- ✅ FIX: dedup contratos by deal_id (one paid contract per deal, even if multiple attendees)
  contratos_cte AS (
    SELECT sdr_email,
      COUNT(DISTINCT deal_id) as contratos
    FROM raw_attendees
    WHERE (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN start_date::DATE AND end_date::DATE
      AND deal_id IS NOT NULL
    GROUP BY sdr_email
  ),
  -- Fallback for rare cases where contract_paid attendee has no deal_id linked
  contratos_no_deal_cte AS (
    SELECT sdr_email,
      COUNT(*) as contratos_extra
    FROM raw_attendees
    WHERE (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN start_date::DATE AND end_date::DATE
      AND deal_id IS NULL
    GROUP BY sdr_email
  ),
  sdr_universe AS (
    SELECT DISTINCT sdr_email, sdr_name
    FROM raw_attendees
    WHERE
      meeting_day BETWEEN start_date::DATE AND end_date::DATE
      OR (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date
         BETWEEN start_date::DATE AND end_date::DATE
      OR (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date
         BETWEEN start_date::DATE AND end_date::DATE
  ),
  sdr_universe_dedup AS (
    SELECT sdr_email, MIN(sdr_name) as sdr_name
    FROM sdr_universe
    GROUP BY sdr_email
  ),
  dedup_agg AS (
    SELECT sdr_email,
      SUM(agendada_count)::int as r1_agendada,
      SUM(realized)::int as r1_realizada,
      SUM(is_noshow)::int as no_shows
    FROM dedup_agendada
    GROUP BY sdr_email
  ),
  sdr_stats AS (
    SELECT u.sdr_email, u.sdr_name,
      COALESCE(a.agendamentos, 0) as agendamentos,
      COALESCE(d.r1_agendada, 0) as r1_agendada,
      COALESCE(d.r1_realizada, 0) as r1_realizada,
      COALESCE(d.no_shows, 0) as no_shows,
      COALESCE(c.contratos, 0) + COALESCE(cn.contratos_extra, 0) as contratos
    FROM sdr_universe_dedup u
    LEFT JOIN dedup_agg d ON d.sdr_email = u.sdr_email
    LEFT JOIN agendamentos_cte a ON a.sdr_email = u.sdr_email
    LEFT JOIN contratos_cte c ON c.sdr_email = u.sdr_email
    LEFT JOIN contratos_no_deal_cte cn ON cn.sdr_email = u.sdr_email
  )
  SELECT json_build_object(
    'metrics', COALESCE(json_agg(
      json_build_object(
        'sdr_email', sdr_email, 'sdr_name', sdr_name,
        'agendamentos', agendamentos,
        'r1_agendada', r1_agendada,
        'r1_realizada', r1_realizada,
        'no_shows', no_shows,
        'contratos', contratos
      ) ORDER BY agendamentos DESC NULLS LAST
    ), '[]'::json)
  ) INTO result FROM sdr_stats;

  RETURN COALESCE(result, json_build_object('metrics', '[]'::json));
END;
$function$;