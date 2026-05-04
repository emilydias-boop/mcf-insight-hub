CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda_aligned(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL,
  bu_filter text DEFAULT NULL,
  include_cancelled boolean DEFAULT false
)
RETURNS TABLE(
  deal_id text,
  deal_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  tipo text,
  data_agendamento text,
  scheduled_at text,
  status_atual text,
  intermediador text,
  closer text,
  origin_name text,
  probability integer,
  attendee_id text,
  meeting_slot_id text,
  attendee_status text,
  sdr_email text,
  booked_at text,
  ordem_no_show integer,
  total_no_shows_deal integer,
  conta_no_show boolean,
  conta_kpi boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  start_d DATE := start_date::date;
  end_d   DATE := end_date::date;
  today_sp DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  effective_end DATE := LEAST(end_d, today_sp);
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
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date as meeting_day,
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
      COALESCE(msa.booked_at, msa.created_at) as effective_booked_at,
      sdr_at_time.squad as sdr_squad_at_booking
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms      ON ms.id = msa.meeting_slot_id
    JOIN crm_deals d           ON d.id = msa.deal_id
    LEFT JOIN crm_contacts c   ON c.id = d.contact_id
    LEFT JOIN closers cl       ON cl.id = ms.closer_id
    LEFT JOIN crm_origins o    ON o.id = d.origin_id
    LEFT JOIN profiles p_booked ON p_booked.id = COALESCE(msa.booked_by, ms.booked_by)
    LEFT JOIN LATERAL (
      SELECT h.squad
      FROM public.sdr s
      INNER JOIN public.sdr_squad_history h ON h.sdr_id = s.id
      WHERE LOWER(s.email) = LOWER(p_booked.email)
        AND h.valid_from <= COALESCE(msa.booked_at, msa.created_at)
        AND COALESCE(h.valid_to, 'infinity'::timestamptz) > COALESCE(msa.booked_at, msa.created_at)
      ORDER BY h.valid_from DESC
      LIMIT 1
    ) sdr_at_time ON true
    WHERE ms.meeting_type = 'r1'
      AND COALESCE(msa.status, 'scheduled') != 'cancelled'
      AND COALESCE(msa.is_partner, false) = false
      AND p_booked.email IS NOT NULL
      AND msa.deal_id IS NOT NULL
      AND (sdr_email_filter IS NULL OR LOWER(p_booked.email) = LOWER(sdr_email_filter))
      AND (
        bu_filter IS NULL
        OR sdr_at_time.squad = bu_filter
        OR (sdr_at_time.squad IS NULL AND cl.bu = bu_filter)
      )
  ),
  -- 1 linha por (deal, meeting_day) — primeira reunião daquele dia para o deal
  per_day AS (
    SELECT DISTINCT ON (deal_id, meeting_day)
      *,
      MIN(effective_booked_at) OVER (PARTITION BY deal_id, meeting_day) as first_booked_at_day
    FROM base
    ORDER BY deal_id, meeting_day, effective_booked_at, scheduled_at
  ),
  -- Ranking por deal: cap em 2 (1º Agendamento + Reagend. Válido)
  ranked AS (
    SELECT pd.*,
      ROW_NUMBER() OVER (
        PARTITION BY pd.deal_id
        ORDER BY pd.first_booked_at_day, pd.meeting_day
      ) as ordem
    FROM per_day pd
  )
  SELECT
    r.d_id::text,
    r.d_name::text,
    r.c_name::text,
    r.c_email::text,
    r.c_phone::text,
    CASE WHEN r.ordem = 1 THEN '1º Agendamento' ELSE 'Reagendamento Válido' END::text,
    r.meeting_day::text,
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
    r.effective_booked_at::text,
    NULL::integer,
    NULL::integer,
    NULL::boolean,
    true as conta_kpi
  FROM ranked r
  WHERE r.ordem <= 2
    AND (r.first_booked_at_day AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_d AND effective_end
  ORDER BY r.first_booked_at_day DESC, r.scheduled_at DESC;
END;
$function$;