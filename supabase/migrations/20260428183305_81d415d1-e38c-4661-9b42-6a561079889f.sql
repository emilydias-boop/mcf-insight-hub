
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda_consorcio(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  result JSON;
  v_consorcio_stage_ids uuid[] := ARRAY[
    'aa194279-c40e-458d-80aa-c5179b414658'::uuid, -- VDA Venda Realizada
    'a35fea26-805e-40d5-b604-56fd6319addf'::uuid, -- VDA Contrato Pago
    '2357df56-bfad-4c4c-b37b-c5f41ce08af6'::uuid, -- EA Produtos Fechados
    'cee41f5d-aad9-435d-a6ee-a96bbda6f257'::uuid  -- EA Venda Realizada 50K
  ];
BEGIN
  WITH raw_attendees AS (
    SELECT
      p_booker.email as sdr_email,
      COALESCE(p_booker.full_name, p_booker.email) as sdr_name,
      msa.deal_id,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date as meeting_day,
      msa.status,
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
      AND (
        sdr_at_time.squad = 'consorcio'
        OR (sdr_at_time.squad IS NULL AND cl.bu = 'consorcio')
      )
      AND p_booker.email IS NOT NULL
  ),
  ranked_movements AS (
    SELECT
      sdr_email, sdr_name, deal_id, effective_booked_at, meeting_day, status,
      ROW_NUMBER() OVER (PARTITION BY deal_id ORDER BY effective_booked_at, meeting_day) as ordem
    FROM raw_attendees
  ),
  filtered_attendees AS (
    SELECT * FROM raw_attendees
    WHERE sdr_email_filter IS NULL OR sdr_email = sdr_email_filter
  ),
  filtered_ranked AS (
    SELECT * FROM ranked_movements
    WHERE sdr_email_filter IS NULL OR sdr_email = sdr_email_filter
  ),
  -- No-shows: cap 1 antes de 28/04/2026, cap 2 a partir de 28/04/2026
  noshow_per_lead AS (
    SELECT sdr_email, deal_id,
      LEAST(COUNT(DISTINCT meeting_day) FILTER (WHERE meeting_day < DATE '2026-04-28'), 1)
      + LEAST(COUNT(DISTINCT meeting_day) FILTER (WHERE meeting_day >= DATE '2026-04-28'), 2)
        as noshow_count
    FROM filtered_attendees
    WHERE status = 'no_show'
      AND meeting_day BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY sdr_email, deal_id
  ),
  dedup_agendada AS (
    SELECT sdr_email, sdr_name, deal_id,
      LEAST(COUNT(DISTINCT meeting_day), 2) as agendada_count,
      MAX(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as realized
    FROM filtered_attendees
    WHERE meeting_day BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY sdr_email, sdr_name, deal_id
  ),
  agendamentos_cte AS (
    SELECT sdr_email, COUNT(*) as agendamentos
    FROM filtered_ranked
    WHERE ordem <= 2
      AND (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY sdr_email
  ),
  -- Mapa SDR (booked_by) por deal: pega a R1 mais antiga do deal
  sdr_by_deal AS (
    SELECT DISTINCT ON (deal_id) deal_id, sdr_email
    FROM filtered_ranked
    WHERE deal_id IS NOT NULL
    ORDER BY deal_id, effective_booked_at ASC
  ),
  -- Propostas Fechadas (Consórcio) — fonte (a): deal_produtos_adquiridos no período
  propostas_via_produtos AS (
    SELECT DISTINCT dpa.deal_id
    FROM deal_produtos_adquiridos dpa
    WHERE dpa.created_at >= start_date::timestamptz
      AND dpa.created_at < (end_date::date + 1)::timestamptz
      AND dpa.deal_id IS NOT NULL
  ),
  -- Propostas Fechadas (Consórcio) — fonte (b): stage de fechamento movido no período
  propostas_via_stage AS (
    SELECT DISTINCT d.id as deal_id
    FROM crm_deals d
    WHERE d.stage_id = ANY(v_consorcio_stage_ids)
      AND d.stage_moved_at >= start_date::timestamptz
      AND d.stage_moved_at < (end_date::date + 1)::timestamptz
  ),
  propostas_unicas AS (
    SELECT deal_id FROM propostas_via_produtos
    UNION
    SELECT deal_id FROM propostas_via_stage
  ),
  propostas_cte AS (
    SELECT s.sdr_email, COUNT(DISTINCT p.deal_id) as propostas_fechadas
    FROM propostas_unicas p
    INNER JOIN sdr_by_deal s ON s.deal_id = p.deal_id
    GROUP BY s.sdr_email
  ),
  sdr_universe AS (
    SELECT DISTINCT sdr_email, sdr_name
    FROM filtered_attendees
    WHERE meeting_day BETWEEN start_date::DATE AND end_date::DATE
      OR (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_date::DATE AND end_date::DATE
  ),
  sdr_universe_dedup AS (
    SELECT sdr_email, MIN(sdr_name) as sdr_name
    FROM sdr_universe
    GROUP BY sdr_email
  ),
  noshow_agg AS (
    SELECT sdr_email, SUM(noshow_count)::int as no_shows
    FROM noshow_per_lead
    GROUP BY sdr_email
  ),
  dedup_agg AS (
    SELECT sdr_email,
      SUM(agendada_count)::int as r1_agendada,
      SUM(realized)::int as r1_realizada
    FROM dedup_agendada
    GROUP BY sdr_email
  ),
  sdr_stats AS (
    SELECT u.sdr_email, u.sdr_name,
      COALESCE(a.agendamentos, 0) as agendamentos,
      COALESCE(d.r1_agendada, 0) as r1_agendada,
      COALESCE(d.r1_realizada, 0) as r1_realizada,
      COALESCE(ns.no_shows, 0) as no_shows,
      COALESCE(pf.propostas_fechadas, 0) as contratos
    FROM sdr_universe_dedup u
    LEFT JOIN dedup_agg d ON d.sdr_email = u.sdr_email
    LEFT JOIN noshow_agg ns ON ns.sdr_email = u.sdr_email
    LEFT JOIN agendamentos_cte a ON a.sdr_email = u.sdr_email
    LEFT JOIN propostas_cte pf ON pf.sdr_email = u.sdr_email
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

GRANT EXECUTE ON FUNCTION public.get_sdr_metrics_from_agenda_consorcio(text, text, text) TO authenticated, anon, service_role;
