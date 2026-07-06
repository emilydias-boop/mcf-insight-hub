
CREATE OR REPLACE FUNCTION public.get_daily_view_incorporador(p_date date, p_closer_meta_reunioes integer DEFAULT 2, p_closer_meta_contratos integer DEFAULT 1, p_extra_sdr_ids uuid[] DEFAULT '{}'::uuid[], p_extra_closer_ids uuid[] DEFAULT '{}'::uuid[], p_hidden_sdr_ids uuid[] DEFAULT '{}'::uuid[], p_hidden_closer_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  WITH
  sdrs_in_squad AS (
    SELECT DISTINCT s.id AS sdr_id, s.name, s.email, COALESCE(s.meta_diaria, 0) AS meta_diaria
    FROM public.sdr s
    LEFT JOIN public.sdr_squad_history h ON h.sdr_id = s.id
      AND h.valid_from::date <= p_date
      AND COALESCE(h.valid_to::date, '9999-12-31'::date) >= p_date
    WHERE s.active = true
      AND (
        h.squad = 'incorporador'
        OR (h.id IS NULL AND s.squad = 'incorporador')
      )
  ),
  sdrs_extra AS (
    SELECT s.id AS sdr_id, s.name, s.email, COALESCE(s.meta_diaria, 0) AS meta_diaria
    FROM public.sdr s
    WHERE s.id = ANY(COALESCE(p_extra_sdr_ids, '{}'::uuid[]))
  ),
  sdrs_all AS (
    SELECT * FROM sdrs_in_squad
    UNION
    SELECT * FROM sdrs_extra
  ),
  sdrs_filtered AS (
    SELECT * FROM sdrs_all
    WHERE sdr_id <> ALL(COALESCE(p_hidden_sdr_ids, '{}'::uuid[]))
  ),
  -- Anchor by booked_at (matches Painel Comercial > Metas da Equipe)
  -- Dedup by (sdr, deal_id, meeting_day) then cap 2 per deal on the day
  sdr_attendees AS (
    SELECT
      LOWER(p_booker.email) AS sdr_email,
      msa.deal_id,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS meeting_day,
      MIN(COALESCE(msa.booked_at, msa.created_at)) AS first_booked_at
    FROM public.meeting_slot_attendees msa
    JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN public.profiles p_booker ON p_booker.id = msa.booked_by
    WHERE ms.meeting_type = 'r1'
      AND msa.is_partner = false
      AND msa.status != 'cancelled'
      AND p_booker.email IS NOT NULL
      AND msa.deal_id IS NOT NULL
    GROUP BY LOWER(p_booker.email), msa.deal_id, (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date
    HAVING (MIN(COALESCE(msa.booked_at, msa.created_at)) AT TIME ZONE 'America/Sao_Paulo')::date = p_date
  ),
  sdr_capped AS (
    SELECT sdr_email, deal_id, COUNT(*) AS raw_cnt,
           LEAST(COUNT(*), 2) AS capped_cnt
    FROM sdr_attendees
    GROUP BY sdr_email, deal_id
  ),
  sdr_counts AS (
    SELECT sdr_email, SUM(capped_cnt)::int AS agendamentos
    FROM sdr_capped
    GROUP BY sdr_email
  ),
  sdr_rows AS (
    SELECT
      sq.sdr_id,
      sq.name,
      sq.email,
      sq.meta_diaria,
      COALESCE(sc.agendamentos, 0) AS agendamentos
    FROM sdrs_filtered sq
    LEFT JOIN sdr_counts sc ON sc.sdr_email = LOWER(sq.email)
  ),
  closers_bu AS (
    SELECT c.id AS closer_id, c.name, c.email
    FROM public.closers c
    WHERE c.is_active = true
      AND COALESCE(c.bu, 'incorporador') = 'incorporador'
  ),
  closers_extra AS (
    SELECT c.id AS closer_id, c.name, c.email
    FROM public.closers c
    WHERE c.id = ANY(COALESCE(p_extra_closer_ids, '{}'::uuid[]))
  ),
  closers_all AS (
    SELECT * FROM closers_bu
    UNION
    SELECT * FROM closers_extra
  ),
  closers_filtered AS (
    SELECT * FROM closers_all
    WHERE closer_id <> ALL(COALESCE(p_hidden_closer_ids, '{}'::uuid[]))
  ),
  closer_attendees AS (
    SELECT
      ms.closer_id,
      msa.deal_id,
      msa.status,
      msa.contract_paid_at
    FROM public.meeting_slot_attendees msa
    JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
    WHERE ms.meeting_type = 'r1'
      AND msa.is_partner = false
      AND msa.status != 'cancelled'
      AND ms.closer_id IS NOT NULL
      AND (
        (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = p_date
        OR (msa.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date = p_date
      )
  ),
  closer_realizadas AS (
    SELECT closer_id, COUNT(DISTINCT deal_id) AS reunioes_realizadas
    FROM closer_attendees
    WHERE status IN ('completed','contract_paid','refunded')
      AND deal_id IS NOT NULL
    GROUP BY closer_id
  ),
  closer_contratos AS (
    SELECT closer_id, COUNT(DISTINCT deal_id) AS contratos_pagos
    FROM closer_attendees
    WHERE contract_paid_at IS NOT NULL
      AND (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date = p_date
      AND deal_id IS NOT NULL
    GROUP BY closer_id
  ),
  closer_rows AS (
    SELECT
      cb.closer_id,
      cb.name,
      cb.email,
      p_closer_meta_reunioes AS meta_reunioes,
      COALESCE(cr.reunioes_realizadas, 0) AS reunioes_realizadas,
      p_closer_meta_contratos AS meta_contratos,
      COALESCE(cc.contratos_pagos, 0) AS contratos_pagos
    FROM closers_filtered cb
    LEFT JOIN closer_realizadas cr ON cr.closer_id = cb.closer_id
    LEFT JOIN closer_contratos cc ON cc.closer_id = cb.closer_id
  )
  SELECT json_build_object(
    'reference_date', p_date,
    'sdrs', COALESCE((
      SELECT json_agg(row_to_json(sr) ORDER BY sr.name)
      FROM sdr_rows sr
    ), '[]'::json),
    'closers', COALESCE((
      SELECT json_agg(row_to_json(cr) ORDER BY cr.name)
      FROM closer_rows cr
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sdr_daily_bookings(p_sdr_email text, p_date date)
 RETURNS TABLE(attendee_id uuid, deal_id uuid, lead_name text, lead_phone text, closer_name text, scheduled_at timestamp with time zone, status text, tags text[])
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    msa.id AS attendee_id,
    msa.deal_id,
    COALESCE(msa.attendee_name, d.name, c.name) AS lead_name,
    COALESCE(msa.attendee_phone, c.phone) AS lead_phone,
    cl.name AS closer_name,
    ms.scheduled_at,
    msa.status,
    COALESCE(d.tags, c.tags, ARRAY[]::text[]) AS tags
  FROM public.meeting_slot_attendees msa
  JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
  LEFT JOIN public.profiles p ON p.id = msa.booked_by
  LEFT JOIN public.closers cl ON cl.id = ms.closer_id
  LEFT JOIN public.crm_deals d ON d.id = msa.deal_id
  LEFT JOIN public.crm_contacts c ON c.id = msa.contact_id
  WHERE ms.meeting_type = 'r1'
    AND msa.is_partner = false
    AND msa.status != 'cancelled'
    AND LOWER(p.email) = LOWER(p_sdr_email)
    AND (COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo')::date = p_date
  ORDER BY ms.scheduled_at;
$function$;
