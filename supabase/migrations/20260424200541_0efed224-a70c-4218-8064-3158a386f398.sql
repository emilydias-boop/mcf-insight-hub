CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL::text,
  bu_filter text DEFAULT NULL::text
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
    SELECT b.*,
      ROW_NUMBER() OVER (
        PARTITION BY b.deal_id
        ORDER BY b.effective_booked_at, b.scheduled_at
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