CREATE OR REPLACE FUNCTION public.get_agenda_fatos_consorcio(start_date text, end_date text)
 RETURNS TABLE(fato text, deal_id uuid, meeting_day date, attendee_status text, sdr_email text, sdr_name text, closer_id uuid, closer_name text, origin_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH base AS (
  SELECT
    msa.id AS attendee_id,
    msa.deal_id,
    COALESCE(msa.deal_id::text, 'msa:' || msa.id::text) AS unit_key,
    (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS meeting_day,
    (COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo')::date AS booked_day,
    msa.status::text AS attendee_status,
    COALESCE(msa.booked_at, msa.created_at) AS effective_booked_at,
    LOWER(p_booker.email) AS sdr_email,
    COALESCE(p_booker.full_name, p_booker.email) AS sdr_name,
    ms.closer_id,
    cl.name AS closer_name,
    o.name AS origin_name,
    -- BU do fato = BU do funil do deal (origin -> bu_origin_mapping, fallback group),
    -- com fallback conservador na BU do closer do slot quando a origem nao tem mapeamento.
    COALESCE(
      (
        SELECT m.bu FROM bu_origin_mapping m
        WHERE (m.entity_type = 'origin' AND m.entity_id = o.id)
           OR (m.entity_type = 'group'  AND m.entity_id = o.group_id)
        ORDER BY (m.entity_type = 'origin') DESC, m.is_default DESC
        LIMIT 1
      ),
      cl.bu
    ) AS fato_bu
  FROM meeting_slot_attendees msa
  INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  INNER JOIN closers cl ON cl.id = ms.closer_id
  LEFT JOIN profiles p_booker ON p_booker.id = msa.booked_by
  LEFT JOIN crm_deals d ON d.id = msa.deal_id
  LEFT JOIN crm_origins o ON o.id = d.origin_id
  WHERE msa.status <> 'cancelled'
    AND ms.meeting_type = 'r1'
    AND msa.is_partner = false
),
scoped AS (
  SELECT * FROM base WHERE fato_bu = 'consorcio'
),
base_reuniao AS (
  SELECT * FROM scoped
  WHERE meeting_day BETWEEN start_date::date AND end_date::date
),
units AS (
  SELECT DISTINCT ON (unit_key, meeting_day)
    unit_key, deal_id, meeting_day, attendee_status,
    sdr_email, sdr_name, closer_id, closer_name, origin_name, effective_booked_at
  FROM base_reuniao
  ORDER BY unit_key, meeting_day,
    CASE attendee_status WHEN 'completed' THEN 0 WHEN 'no_show' THEN 1 ELSE 2 END,
    effective_booked_at
),
capped AS (
  SELECT * FROM (
    SELECT u.*, ROW_NUMBER() OVER (PARTITION BY unit_key ORDER BY meeting_day) AS rn
    FROM units u
  ) x
  WHERE rn <= 2
),
base_agendamento AS (
  SELECT * FROM scoped
  WHERE booked_day BETWEEN start_date::date AND end_date::date
),
units_ag AS (
  SELECT DISTINCT ON (unit_key, booked_day)
    unit_key, deal_id, booked_day, attendee_status,
    sdr_email, sdr_name, closer_id, closer_name, origin_name, effective_booked_at
  FROM base_agendamento
  ORDER BY unit_key, booked_day, effective_booked_at
),
capped_ag AS (
  SELECT * FROM (
    SELECT u.*, ROW_NUMBER() OVER (PARTITION BY unit_key ORDER BY booked_day) AS rn
    FROM units_ag u
  ) x
  WHERE rn <= 2
)
SELECT 'agendada'::text, deal_id, meeting_day, attendee_status, sdr_email, sdr_name, closer_id, closer_name, origin_name FROM capped
UNION ALL
SELECT 'realizada'::text, deal_id, meeting_day, attendee_status, sdr_email, sdr_name, closer_id, closer_name, origin_name FROM capped WHERE attendee_status = 'completed'
UNION ALL
SELECT 'no_show'::text, deal_id, meeting_day, attendee_status, sdr_email, sdr_name, closer_id, closer_name, origin_name FROM capped WHERE attendee_status = 'no_show'
UNION ALL
SELECT 'fechada_agenda'::text, deal_id, meeting_day, attendee_status, sdr_email, sdr_name, closer_id, closer_name, origin_name FROM capped WHERE attendee_status = 'contract_paid'
UNION ALL
SELECT 'agendamento'::text, deal_id, booked_day, attendee_status, sdr_email, sdr_name, closer_id, closer_name, origin_name FROM capped_ag;
$function$;

GRANT EXECUTE ON FUNCTION public.get_agenda_fatos_consorcio(text, text) TO authenticated, service_role;