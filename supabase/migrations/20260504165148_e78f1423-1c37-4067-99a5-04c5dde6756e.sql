DROP FUNCTION IF EXISTS public.get_sdr_pendentes_drilldown(text,text,text,text);

CREATE OR REPLACE FUNCTION public.get_sdr_pendentes_drilldown(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL,
  bu_filter text DEFAULT NULL
)
RETURNS TABLE(
  out_deal_id text, out_deal_name text, out_contact_name text, out_contact_email text, out_contact_phone text,
  out_scheduled_at text, out_status_atual text, out_intermediador text, out_closer text, out_origin_name text,
  out_attendee_id text, out_meeting_slot_id text, out_attendee_status text, out_sdr_email text,
  out_pendente_reason text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  start_d DATE := start_date::date;
  end_d DATE := end_date::date;
  today_sp DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  effective_end DATE := LEAST(end_d, today_sp);
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT * FROM (
      SELECT
        msa.id as msa_id, msa.deal_id as b_deal_id, msa.status as b_status, msa.is_partner,
        ms.id as ms_id, ms.scheduled_at as b_scheduled_at,
        (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date as meeting_day,
        cl.name as closer_name, cl.bu as closer_bu,
        d.name as d_name,
        c.name as c_name, c.email as c_email, c.phone as c_phone,
        o.name as o_name,
        p.email as booker_email, p.full_name as booker_name,
        sa.squad as sdr_squad
      FROM meeting_slot_attendees msa
      JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
      JOIN crm_deals d ON d.id = msa.deal_id
      LEFT JOIN crm_contacts c ON c.id = d.contact_id
      LEFT JOIN closers cl ON cl.id = ms.closer_id
      LEFT JOIN crm_origins o ON o.id = d.origin_id
      LEFT JOIN profiles p ON p.id = msa.booked_by
      LEFT JOIN LATERAL (
        SELECT h.squad FROM sdr s
        JOIN sdr_squad_history h ON h.sdr_id = s.id
        WHERE LOWER(s.email)=LOWER(p.email)
          AND h.valid_from <= COALESCE(msa.booked_at, msa.created_at)
          AND COALESCE(h.valid_to,'infinity'::timestamptz) > COALESCE(msa.booked_at, msa.created_at)
        ORDER BY h.valid_from DESC LIMIT 1
      ) sa ON true
      WHERE ms.meeting_type='r1'
        AND COALESCE(msa.is_partner,false)=false
        AND msa.status != 'cancelled'
        AND p.email IS NOT NULL
        AND (bu_filter IS NULL OR sa.squad=bu_filter OR (sa.squad IS NULL AND cl.bu=bu_filter))
        AND (sdr_email_filter IS NULL OR LOWER(p.email)=LOWER(sdr_email_filter))
    ) inner_b
    WHERE inner_b.meeting_day BETWEEN start_d AND end_d
  ),
  by_day AS (
    SELECT booker_email as sdr_e, b.b_deal_id, meeting_day,
      BOOL_OR(b_status IN ('completed','contract_paid','refunded')) as has_real,
      BOOL_OR(b_status='no_show') as has_ns,
      (ARRAY_AGG(msa_id ORDER BY
        CASE WHEN b_status='no_show' THEN 0
             WHEN b_status NOT IN ('completed','contract_paid','refunded') THEN 1
             ELSE 2 END,
        b_scheduled_at))[1] as pick_msa_id
    FROM base b
    GROUP BY booker_email, b.b_deal_id, meeting_day
  ),
  ranked AS (
    SELECT bd.*,
      ROW_NUMBER() OVER (PARTITION BY bd.sdr_e, bd.b_deal_id ORDER BY meeting_day) as day_ord,
      ROW_NUMBER() OVER (PARTITION BY bd.sdr_e, bd.b_deal_id, bd.has_ns ORDER BY meeting_day) as ns_ord
    FROM by_day bd
  ),
  pendentes AS (
    SELECT r.*,
      CASE
        WHEN NOT has_real AND NOT has_ns THEN 'sem_desfecho'
        WHEN NOT has_real AND has_ns AND meeting_day < DATE '2026-05-01' AND ns_ord > 1 THEN 'no_show_acima_cap'
        WHEN NOT has_real AND has_ns AND meeting_day >= DATE '2026-05-01' AND ns_ord > 2 THEN 'no_show_acima_cap'
        ELSE NULL
      END as reason
    FROM ranked r
    WHERE day_ord <= 2 AND meeting_day <= effective_end
  )
  SELECT
    b.b_deal_id::text, b.d_name::text, b.c_name::text, b.c_email::text, b.c_phone::text,
    b.b_scheduled_at::text, COALESCE(b.b_status,'scheduled')::text,
    COALESCE(b.booker_name, b.booker_email,'')::text, COALESCE(b.closer_name,'')::text, COALESCE(b.o_name,'')::text,
    b.msa_id::text, b.ms_id::text, COALESCE(b.b_status,'scheduled')::text,
    COALESCE(b.booker_email,'')::text,
    p.reason::text
  FROM pendentes p
  JOIN base b ON b.msa_id = p.pick_msa_id
  WHERE p.reason IS NOT NULL
  ORDER BY b.b_scheduled_at DESC;
END;
$$;