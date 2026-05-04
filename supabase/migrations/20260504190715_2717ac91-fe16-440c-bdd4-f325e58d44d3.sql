CREATE OR REPLACE FUNCTION public.get_funnel_r1_attendees_aligned(
  start_date text,
  end_date text,
  bu_filter text DEFAULT NULL
)
RETURNS TABLE (
  deal_id uuid,
  sdr_email text,
  meeting_day date,
  scheduled_at timestamptz,
  is_realized boolean,
  is_noshow boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH raw_attendees AS (
    SELECT
      msa.deal_id,
      p_booker.email AS sdr_email,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS meeting_day,
      ms.scheduled_at,
      msa.status,
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
      AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN start_date::date AND end_date::date
  )
  SELECT
    deal_id,
    sdr_email,
    meeting_day,
    MIN(scheduled_at) AS scheduled_at,
    bool_or(status IN ('completed','contract_paid','refunded')) AS is_realized,
    bool_or(status = 'no_show') AS is_noshow
  FROM raw_attendees
  GROUP BY deal_id, sdr_email, meeting_day;
$$;

GRANT EXECUTE ON FUNCTION public.get_funnel_r1_attendees_aligned(text, text, text) TO authenticated, anon;