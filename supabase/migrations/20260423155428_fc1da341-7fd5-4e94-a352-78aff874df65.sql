-- ============================================================================
-- Reagendamento R1 com contagem honesta (regra ordinal)
-- ============================================================================
-- Substitui a lógica de "1º Agendamento vs Reagendamento" baseada em
-- parent_attendee_id/is_reschedule por uma classificação ORDINAL:
--   ordem 1 → '1º Agendamento'      (conta para SDR)
--   ordem 2 → 'Reagendamento Válido' (conta para SDR)
--   ordem 3+ → 'Reagendamento Inválido' (NÃO conta — registrado para auditoria)
--
-- Tope duro: cada deal contabiliza no máximo 2 movimentos por SDR no período.
-- ============================================================================

-- 1) RPC de MÉTRICAS (4-arg) — agendamentos baseados em ordem ≤ 2 por deal
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL,
  bu_filter text DEFAULT NULL
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
  -- Classificação ORDINAL: ordem do movimento dentro do deal (1, 2, 3, ...)
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
  -- Agendamentos válidos: apenas os 2 primeiros movimentos do deal contam
  agendamentos_cte AS (
    SELECT sdr_email,
      COUNT(*) as agendamentos
    FROM ranked_movements
    WHERE ordem <= 2
      AND (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY sdr_email
  ),
  contratos_cte AS (
    SELECT sdr_email,
      COUNT(*) as contratos
    FROM raw_attendees
    WHERE (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN start_date::DATE AND end_date::DATE
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
      COALESCE(c.contratos, 0) as contratos
    FROM sdr_universe_dedup u
    LEFT JOIN dedup_agg d ON d.sdr_email = u.sdr_email
    LEFT JOIN agendamentos_cte a ON a.sdr_email = u.sdr_email
    LEFT JOIN contratos_cte c ON c.sdr_email = u.sdr_email
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

-- 2) RPC de LISTAGEM (4-arg) — emite tipo baseado em ordem do movimento
CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL,
  bu_filter text DEFAULT NULL
)
RETURNS TABLE(
  deal_id text, deal_name text, contact_name text, contact_email text,
  contact_phone text, tipo text, data_agendamento text, scheduled_at text,
  status_atual text, intermediador text, closer text, origin_name text,
  probability integer, attendee_id text, meeting_slot_id text,
  attendee_status text, sdr_email text, booked_at text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      msa.id as msa_id,
      msa.deal_id,
      msa.status,
      msa.is_partner,
      ms.id as ms_id,
      ms.scheduled_at,
      ms.meeting_type,
      ms.closer_id,
      cl.name as closer_name,
      cl.bu as closer_bu,
      d.id as d_id,
      d.name as d_name,
      d.probability,
      d.contact_id,
      d.origin_id,
      c.name as c_name,
      c.email as c_email,
      c.phone as c_phone,
      o.name as o_name,
      p_booked.email as booker_email,
      p_booked.full_name as booker_full_name,
      COALESCE(msa.booked_at, msa.created_at) as effective_booked_at
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms      ON ms.id = msa.meeting_slot_id
    JOIN crm_deals d           ON d.id = msa.deal_id
    LEFT JOIN crm_contacts c   ON c.id = d.contact_id
    LEFT JOIN closers cl       ON cl.id = ms.closer_id
    LEFT JOIN crm_origins o    ON o.id = d.origin_id
    LEFT JOIN profiles p_booked ON p_booked.id = COALESCE(msa.booked_by, ms.booked_by)
    WHERE ms.meeting_type = 'r1'
      AND COALESCE(msa.status, 'scheduled') != 'cancelled'
      AND COALESCE(msa.is_partner, false) = false
  ),
  ranked AS (
    -- Classifica ordem do movimento dentro do deal (todos os movimentos, não só do período)
    SELECT b.*,
      ROW_NUMBER() OVER (
        PARTITION BY deal_id
        ORDER BY effective_booked_at, scheduled_at
      ) as ordem
    FROM base b
  )
  SELECT
    r.d_id::text,
    r.d_name::text,
    r.c_name::text,
    r.c_email::text,
    r.c_phone::text,
    CASE
      WHEN r.ordem = 1 THEN '1º Agendamento'
      WHEN r.ordem = 2 THEN 'Reagendamento Válido'
      ELSE 'Reagendamento Inválido'
    END::text,
    (r.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date::text,
    r.scheduled_at::text,
    COALESCE(r.status, 'scheduled')::text,
    COALESCE(r.booker_full_name, r.booker_email, '')::text,
    COALESCE(r.closer_name, '')::text,
    COALESCE(r.o_name, '')::text,
    r.probability,
    r.msa_id::text,
    r.ms_id::text,
    COALESCE(r.status, 'scheduled')::text,
    COALESCE(r.booker_email, '')::text,
    r.effective_booked_at::text
  FROM ranked r
  WHERE (r.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date
        BETWEEN start_date::date AND end_date::date
    AND (sdr_email_filter IS NULL OR LOWER(r.booker_email) = LOWER(sdr_email_filter))
    AND (bu_filter IS NULL OR r.closer_bu = bu_filter)
  ORDER BY r.scheduled_at DESC;
END;
$function$;

-- 3) RPC de LISTAGEM (3-arg) — mesma classificação ordinal, sem filtro de BU
CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL
)
RETURNS TABLE(
  deal_id text, deal_name text, contact_name text, contact_email text,
  contact_phone text, tipo text, data_agendamento text, scheduled_at text,
  status_atual text, intermediador text, closer text, origin_name text,
  probability integer, attendee_id text, meeting_slot_id text,
  attendee_status text, sdr_email text, booked_at text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      msa.id as msa_id, msa.deal_id, msa.status, msa.is_partner,
      ms.id as ms_id, ms.scheduled_at, ms.meeting_type, ms.closer_id,
      cl.name as closer_name,
      d.id as d_id, d.name as d_name, d.probability, d.contact_id, d.origin_id,
      c.name as c_name, c.email as c_email, c.phone as c_phone,
      o.name as o_name,
      p_booked.email as booker_email,
      p_booked.full_name as booker_full_name,
      COALESCE(msa.booked_at, msa.created_at) as effective_booked_at
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms      ON ms.id = msa.meeting_slot_id
    JOIN crm_deals d           ON d.id = msa.deal_id
    LEFT JOIN crm_contacts c   ON c.id = d.contact_id
    LEFT JOIN closers cl       ON cl.id = ms.closer_id
    LEFT JOIN crm_origins o    ON o.id = d.origin_id
    LEFT JOIN profiles p_booked ON p_booked.id = COALESCE(msa.booked_by, ms.booked_by)
    WHERE ms.meeting_type = 'r1'
      AND COALESCE(msa.status, 'scheduled') != 'cancelled'
      AND COALESCE(msa.is_partner, false) = false
  ),
  ranked AS (
    SELECT b.*,
      ROW_NUMBER() OVER (
        PARTITION BY deal_id
        ORDER BY effective_booked_at, scheduled_at
      ) as ordem
    FROM base b
  )
  SELECT
    r.d_id::text, r.d_name::text, r.c_name::text, r.c_email::text, r.c_phone::text,
    CASE
      WHEN r.ordem = 1 THEN '1º Agendamento'
      WHEN r.ordem = 2 THEN 'Reagendamento Válido'
      ELSE 'Reagendamento Inválido'
    END::text,
    (r.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date::text,
    r.scheduled_at::text,
    COALESCE(r.status, 'scheduled')::text,
    COALESCE(r.booker_full_name, r.booker_email, '')::text,
    COALESCE(r.closer_name, '')::text,
    COALESCE(r.o_name, '')::text,
    r.probability,
    r.msa_id::text, r.ms_id::text,
    COALESCE(r.status, 'scheduled')::text,
    COALESCE(r.booker_email, '')::text,
    r.effective_booked_at::text
  FROM ranked r
  WHERE (r.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date
        BETWEEN start_date::date AND end_date::date
    AND (sdr_email_filter IS NULL OR LOWER(r.booker_email) = LOWER(sdr_email_filter))
  ORDER BY r.scheduled_at DESC;
END;
$function$;