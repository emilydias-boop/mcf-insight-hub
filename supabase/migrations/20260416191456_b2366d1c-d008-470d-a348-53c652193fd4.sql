
-- Atualiza RPC get_carrinho_r2_attendees para priorizar R2s "vivos" sobre refunded/cancelled na deduplicação por telefone
CREATE OR REPLACE FUNCTION public.get_carrinho_r2_attendees(p_week_start date, p_window_start timestamp with time zone, p_window_end timestamp with time zone)
 RETURNS TABLE(attendee_id uuid, attendee_name text, attendee_phone text, attendee_status text, r2_status_id uuid, r2_status_name text, r2_status_color text, carrinho_status text, carrinho_updated_at timestamp with time zone, carrinho_week_start date, deal_id uuid, contact_id uuid, contact_phone text, contact_email text, contact_name text, partner_name text, contract_paid_at timestamp with time zone, meeting_slot_id uuid, meeting_status text, scheduled_at timestamp with time zone, r2_closer_id uuid, r2_closer_name text, r2_closer_color text, deal_name text, r1_scheduled_at timestamp with time zone, r1_closer_name text, r1_closer_id uuid, r1_contract_paid_at timestamp with time zone, is_encaixado boolean, phone_dedup_key text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH raw_r2 AS (
  SELECT
    msa.id,
    msa.attendee_name,
    msa.attendee_phone,
    msa.status AS attendee_status,
    msa.r2_status_id,
    msa.carrinho_status,
    msa.carrinho_updated_at,
    msa.carrinho_week_start,
    msa.deal_id,
    msa.contact_id,
    msa.partner_name,
    msa.contract_paid_at,
    ms.id AS meeting_slot_id,
    ms.status AS meeting_status,
    ms.scheduled_at,
    ms.closer_id,
    (msa.carrinho_week_start = p_week_start) AS is_encaixado
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  WHERE ms.meeting_type = 'r2'
    AND ms.status NOT IN ('cancelled', 'rescheduled')
    AND (
      msa.carrinho_week_start = p_week_start
      OR (
        ms.scheduled_at >= p_window_start
        AND ms.scheduled_at < p_window_end
        AND msa.carrinho_week_start IS NULL
      )
    )
),
with_phone_key AS (
  SELECT *,
    RIGHT(regexp_replace(COALESCE(attendee_phone, ''), '\D', '', 'g'), 9) AS phone_key,
    -- Score por status: maior = mais "vivo". Refunded/cancelled vão para o final.
    CASE lower(COALESCE(attendee_status, ''))
      WHEN 'contract_paid' THEN 100
      WHEN 'presente'      THEN 90
      WHEN 'completed'     THEN 80
      WHEN 'invited'       THEN 60
      WHEN 'scheduled'     THEN 60
      WHEN 'no_show'       THEN 40
      WHEN 'refunded'      THEN 10
      WHEN 'cancelled'     THEN 0
      ELSE 50
    END AS status_score
  FROM raw_r2
),
ranked AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY
        CASE
          WHEN phone_key != '' AND length(phone_key) >= 8 THEN phone_key
          ELSE id::text
        END
      ORDER BY
        is_encaixado DESC,        -- 1º: encaixados explicitamente vêm primeiro
        status_score DESC,        -- 2º: priorizar status "vivo" sobre refunded/cancelled
        scheduled_at DESC         -- 3º: tiebreaker = mais recente
    ) AS rn
  FROM with_phone_key
),
deduped AS (
  SELECT * FROM ranked WHERE rn = 1
),
r1_data AS (
  SELECT DISTINCT ON (msa_r1.deal_id)
    msa_r1.deal_id,
    ms_r1.scheduled_at AS r1_scheduled_at,
    c_r1.name AS r1_closer_name,
    c_r1.id AS r1_closer_id,
    msa_r1.contract_paid_at AS r1_contract_paid_at
  FROM meeting_slot_attendees msa_r1
  JOIN meeting_slots ms_r1 ON ms_r1.id = msa_r1.meeting_slot_id
  LEFT JOIN closers c_r1 ON c_r1.id = ms_r1.closer_id
  WHERE ms_r1.meeting_type = 'r1'
    AND msa_r1.deal_id IN (SELECT deal_id FROM deduped WHERE deal_id IS NOT NULL)
    AND msa_r1.status != 'cancelled'
  ORDER BY msa_r1.deal_id, ms_r1.scheduled_at DESC
)
SELECT
  d.id AS attendee_id,
  d.attendee_name,
  d.attendee_phone,
  d.attendee_status,
  d.r2_status_id,
  rso.name AS r2_status_name,
  rso.color AS r2_status_color,
  d.carrinho_status,
  d.carrinho_updated_at,
  d.carrinho_week_start,
  d.deal_id,
  d.contact_id,
  cc.phone AS contact_phone,
  cc.email AS contact_email,
  cc.name AS contact_name,
  d.partner_name,
  d.contract_paid_at,
  d.meeting_slot_id,
  d.meeting_status,
  d.scheduled_at,
  d.closer_id AS r2_closer_id,
  cl.name AS r2_closer_name,
  cl.color AS r2_closer_color,
  cd.name AS deal_name,
  r1.r1_scheduled_at,
  r1.r1_closer_name,
  r1.r1_closer_id,
  r1.r1_contract_paid_at,
  d.is_encaixado,
  d.phone_key AS phone_dedup_key
FROM deduped d
LEFT JOIN r2_status_options rso ON rso.id = d.r2_status_id
LEFT JOIN closers cl ON cl.id = d.closer_id
LEFT JOIN crm_deals cd ON cd.id = d.deal_id
LEFT JOIN crm_contacts cc ON cc.id = d.contact_id
LEFT JOIN r1_data r1 ON r1.deal_id = d.deal_id
ORDER BY d.scheduled_at ASC;
$function$;
