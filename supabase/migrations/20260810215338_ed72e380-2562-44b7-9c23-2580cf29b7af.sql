CREATE OR REPLACE FUNCTION public.caucoes_efetivas(
  p_from date,
  p_to date,
  p_bu text DEFAULT 'incorporador'
)
RETURNS TABLE (
  attendee_id uuid,
  deal_id uuid,
  lead_name text,
  eff_date date,
  fonte text,
  contract_paid_at timestamptz,
  closer_id uuid,
  closer_name text,
  closer_bu text,
  sdr_id uuid,
  sdr_email text,
  sdr_name text,
  segment text,
  valor numeric,
  origin_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
WITH paid AS MATERIALIZED (
  SELECT DISTINCT ON (COALESCE(msa.deal_id::text, msa.id::text))
    msa.id            AS attendee_id,
    msa.deal_id       AS deal_id,
    msa.attendee_name AS lead_name,
    msa.booked_by     AS slot_booked_by,
    msa.contract_paid_at,
    ms.closer_id      AS slot_closer_id,
    cl.bu             AS slot_bu
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  LEFT JOIN closers cl ON cl.id = ms.closer_id
  WHERE msa.contract_paid_at IS NOT NULL
    AND msa.is_partner = false
    AND msa.status <> 'cancelled'
    AND msa.contract_paid_at >= (p_from - INTERVAL '400 days')
    AND msa.contract_paid_at <= (p_to + INTERVAL '400 days')
  ORDER BY COALESCE(msa.deal_id::text, msa.id::text), msa.contract_paid_at
),
enriched AS MATERIALIZED (
  SELECT
    p.*,
    cd.icp_segment,
    cd.value    AS deal_value,
    cd.origin_id,
    lower(NULLIF(TRIM(COALESCE(cc.email, cd.custom_fields->>'email')), '')) AS email,
    NULLIF(right(regexp_replace(COALESCE(cc.phone, cd.custom_fields->>'telefone', ''), '\D', '', 'g'), 9), '') AS phone9,
    r1.closer_id AS r1_closer_id,
    r1c.name     AS r1_closer_name,
    r1c.bu       AS r1_bu,
    r1.booked_by AS r1_booked_by
  FROM paid p
  LEFT JOIN crm_deals cd ON cd.id = p.deal_id
  LEFT JOIN crm_contacts cc ON cc.id = cd.contact_id
  LEFT JOIN LATERAL (
    SELECT ms2.closer_id, m2.booked_by
    FROM meeting_slot_attendees m2
    JOIN meeting_slots ms2 ON ms2.id = m2.meeting_slot_id
    WHERE m2.deal_id = p.deal_id
      AND ms2.meeting_type = 'r1'
      AND m2.status <> 'cancelled'
    ORDER BY ms2.scheduled_at DESC
    LIMIT 1
  ) r1 ON true
  LEFT JOIN closers r1c ON r1c.id = r1.closer_id
),
ctx AS MATERIALIZED (
  SELECT
    ht.linked_deal_id,
    lower(ht.customer_email) AS email,
    NULLIF(right(regexp_replace(COALESCE(ht.customer_phone, ''), '\D', '', 'g'), 9), '') AS phone9,
    (ht.sale_date AT TIME ZONE 'America/Sao_Paulo')::date AS tx_date
  FROM hubla_transactions ht
  WHERE (
        upper(COALESCE(ht.product_code, '')) LIKE 'A000%'
     OR upper(COALESCE(ht.product_name, '')) LIKE '%A000%'
     OR upper(COALESCE(ht.product_name, '')) LIKE '%CONTRATO%'
  )
    AND lower(COALESCE(ht.sale_status, '')) IN ('pago', 'paid', 'approved', 'completed')
    AND COALESCE(ht.event_type, '') NOT ILIKE '%refund%'
    AND COALESCE(ht.net_value, 0) > 0
    AND ht.sale_date IS NOT NULL
),
tx AS MATERIALIZED (
  SELECT attendee_id, min(tx_date) AS tx_date
  FROM (
    SELECT e.attendee_id, c.tx_date
    FROM enriched e JOIN ctx c ON c.linked_deal_id = e.deal_id
    WHERE e.deal_id IS NOT NULL
    UNION ALL
    SELECT e.attendee_id, c.tx_date
    FROM enriched e JOIN ctx c ON c.email = e.email
    WHERE e.email IS NOT NULL
    UNION ALL
    SELECT e.attendee_id, c.tx_date
    FROM enriched e JOIN ctx c ON c.phone9 = e.phone9
    WHERE e.phone9 IS NOT NULL
  ) m
  GROUP BY attendee_id
)
SELECT
  e.attendee_id,
  e.deal_id,
  e.lead_name,
  COALESCE(t.tx_date, (e.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date) AS eff_date,
  CASE WHEN t.tx_date IS NOT NULL THEN 'transacao' ELSE 'manual' END AS fonte,
  e.contract_paid_at,
  COALESCE(e.r1_closer_id, e.slot_closer_id) AS closer_id,
  COALESCE(e.r1_closer_name, sc.name)        AS closer_name,
  COALESCE(e.r1_bu, e.slot_bu)               AS closer_bu,
  COALESCE(e.r1_booked_by, e.slot_booked_by) AS sdr_id,
  pr.email                                   AS sdr_email,
  COALESCE(pr.full_name, pr.email)           AS sdr_name,
  NULLIF(UPPER(TRIM(COALESCE(e.icp_segment, ''))), '') AS segment,
  e.deal_value                               AS valor,
  e.origin_id
FROM enriched e
LEFT JOIN tx t ON t.attendee_id = e.attendee_id
LEFT JOIN closers sc ON sc.id = e.slot_closer_id
LEFT JOIN profiles pr ON pr.id = COALESCE(e.r1_booked_by, e.slot_booked_by)
WHERE COALESCE(t.tx_date, (e.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date) BETWEEN p_from AND p_to
  AND (
    p_bu IS NULL
    OR COALESCE(e.r1_bu, e.slot_bu) IS NULL
    OR COALESCE(e.r1_bu, e.slot_bu) = p_bu
  );
$fn$;