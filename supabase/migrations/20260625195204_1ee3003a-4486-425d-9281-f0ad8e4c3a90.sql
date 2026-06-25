
-- =========================================================================
-- Daily View (BU Incorporador) — RPCs
-- =========================================================================

-- 1) Consolidated daily view: SDRs + Closers metrics for a given date
CREATE OR REPLACE FUNCTION public.get_daily_view_incorporador(
  p_date date,
  p_closer_meta_reunioes integer DEFAULT 2,
  p_closer_meta_contratos integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  WITH
  -- SDRs that belonged to incorporador squad on p_date
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
  -- Count agendamentos per SDR for the day (R1, non-partner), dedup by (deal_id, day)
  sdr_attendees AS (
    SELECT
      LOWER(p_booker.email) AS sdr_email,
      msa.deal_id,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS meeting_day
    FROM public.meeting_slot_attendees msa
    JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN public.profiles p_booker ON p_booker.id = msa.booked_by
    WHERE ms.meeting_type = 'r1'
      AND msa.is_partner = false
      AND msa.status != 'cancelled'
      AND p_booker.email IS NOT NULL
      AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = p_date
  ),
  sdr_counts AS (
    SELECT sdr_email, COUNT(DISTINCT deal_id) AS agendamentos
    FROM sdr_attendees
    GROUP BY sdr_email
  ),
  sdr_rows AS (
    SELECT
      sq.sdr_id,
      sq.name,
      sq.email,
      sq.meta_diaria,
      COALESCE(sc.agendamentos, 0) AS agendamentos
    FROM sdrs_in_squad sq
    LEFT JOIN sdr_counts sc ON sc.sdr_email = LOWER(sq.email)
  ),
  -- Closers in incorporador BU
  closers_bu AS (
    SELECT c.id AS closer_id, c.name, c.email
    FROM public.closers c
    WHERE c.is_active = true
      AND COALESCE(c.bu, 'incorporador') = 'incorporador'
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
    FROM closers_bu cb
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
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_view_incorporador(date, integer, integer) TO authenticated;

-- 2) SDR drilldown: bookings (leads agendados) for a given date with tags
CREATE OR REPLACE FUNCTION public.get_sdr_daily_bookings(
  p_sdr_email text,
  p_date date
)
RETURNS TABLE (
  attendee_id uuid,
  deal_id uuid,
  lead_name text,
  lead_phone text,
  closer_name text,
  scheduled_at timestamptz,
  status text,
  tags text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = p_date
  ORDER BY ms.scheduled_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_sdr_daily_bookings(text, date) TO authenticated;

-- 3) SDR drilldown: daily call summary for a window
CREATE OR REPLACE FUNCTION public.get_sdr_call_daily_summary(
  p_sdr_user_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE (
  day date,
  attempts integer,
  effective integer,
  qualified integer,
  total_seconds integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      (COALESCE(c.started_at, c.created_at) AT TIME ZONE 'America/Sao_Paulo')::date AS day,
      COALESCE(c.duration_seconds, 0) AS dur,
      c.status,
      c.outcome
    FROM public.calls c
    WHERE c.user_id = p_sdr_user_id
      AND (COALESCE(c.started_at, c.created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
  )
  SELECT
    day,
    COUNT(*)::int AS attempts,
    COUNT(*) FILTER (WHERE dur >= 30)::int AS effective,
    COUNT(*) FILTER (WHERE dur >= 120)::int AS qualified,
    COALESCE(SUM(dur), 0)::int AS total_seconds
  FROM base
  GROUP BY day
  ORDER BY day;
$$;

GRANT EXECUTE ON FUNCTION public.get_sdr_call_daily_summary(uuid, date, date) TO authenticated;

-- 4) Closer drilldown: meetings done in a day
CREATE OR REPLACE FUNCTION public.get_closer_daily_meetings(
  p_closer_id uuid,
  p_date date
)
RETURNS TABLE (
  attendee_id uuid,
  deal_id uuid,
  lead_name text,
  scheduled_at timestamptz,
  status text,
  tags text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    msa.id,
    msa.deal_id,
    COALESCE(msa.attendee_name, d.name, c.name),
    ms.scheduled_at,
    msa.status,
    COALESCE(d.tags, c.tags, ARRAY[]::text[])
  FROM public.meeting_slot_attendees msa
  JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
  LEFT JOIN public.crm_deals d ON d.id = msa.deal_id
  LEFT JOIN public.crm_contacts c ON c.id = msa.contact_id
  WHERE ms.closer_id = p_closer_id
    AND ms.meeting_type = 'r1'
    AND msa.is_partner = false
    AND msa.status IN ('completed','contract_paid','refunded')
    AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = p_date
  ORDER BY ms.scheduled_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_closer_daily_meetings(uuid, date) TO authenticated;

-- 5) Closer drilldown: contracts paid in a day
CREATE OR REPLACE FUNCTION public.get_closer_daily_contracts(
  p_closer_id uuid,
  p_date date
)
RETURNS TABLE (
  attendee_id uuid,
  deal_id uuid,
  lead_name text,
  product_name text,
  value numeric,
  contract_paid_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    msa.id,
    msa.deal_id,
    COALESCE(msa.attendee_name, d.name, c.name),
    d.product_name,
    d.value,
    msa.contract_paid_at
  FROM public.meeting_slot_attendees msa
  JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
  LEFT JOIN public.crm_deals d ON d.id = msa.deal_id
  LEFT JOIN public.crm_contacts c ON c.id = msa.contact_id
  WHERE ms.closer_id = p_closer_id
    AND ms.meeting_type = 'r1'
    AND msa.is_partner = false
    AND msa.contract_paid_at IS NOT NULL
    AND (msa.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date = p_date
  ORDER BY msa.contract_paid_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_closer_daily_contracts(uuid, date) TO authenticated;
