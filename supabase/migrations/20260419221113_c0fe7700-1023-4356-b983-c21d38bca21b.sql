CREATE OR REPLACE FUNCTION public.get_carrinho_r2_attendees(
  p_week_start date,
  p_window_start timestamp with time zone,
  p_window_end timestamp with time zone,
  p_apply_contract_cutoff boolean DEFAULT false
)
 RETURNS TABLE(
   attendee_id uuid, attendee_name text, attendee_phone text, attendee_status text,
   r2_status_id uuid, r2_status_name text, r2_status_color text,
   carrinho_status text, carrinho_updated_at timestamp with time zone, carrinho_week_start date,
   deal_id uuid, contact_id uuid, contact_phone text, contact_email text, contact_name text,
   partner_name text, contract_paid_at timestamp with time zone,
   meeting_slot_id uuid, meeting_status text, scheduled_at timestamp with time zone,
   r2_closer_id uuid, r2_closer_name text, r2_closer_color text,
   deal_name text,
   r1_scheduled_at timestamp with time zone, r1_closer_name text, r1_closer_id uuid,
   r1_contract_paid_at timestamp with time zone,
   is_encaixado boolean, phone_dedup_key text,
   dentro_corte boolean
 )
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
  SELECT r.*,
    RIGHT(regexp_replace(COALESCE(r.attendee_phone, ''), '\D', '', 'g'), 9) AS phone_key,
    CASE lower(COALESCE(r.attendee_status, ''))
      WHEN 'contract_paid' THEN 100
      WHEN 'presente'      THEN 90
      WHEN 'completed'     THEN 80
      WHEN 'invited'       THEN 60
      WHEN 'scheduled'     THEN 60
      WHEN 'no_show'       THEN 40
      WHEN 'refunded'      THEN 10
      WHEN 'cancelled'     THEN 0
      ELSE 50
    END AS status_score,
    CASE lower(COALESCE(rso.name, ''))
      WHEN 'aprovado'        THEN 100
      WHEN 'compareceu'      THEN 95
      WHEN 'realizada'       THEN 95
      WHEN 'follow up'       THEN 70
      WHEN 'follow-up'       THEN 70
      WHEN 'agendado'        THEN 60
      WHEN 'próxima semana'  THEN 50
      WHEN 'proxima semana'  THEN 50
      WHEN 'desistente'      THEN 20
      WHEN 'no-show'         THEN 15
      WHEN 'no show'         THEN 15
      WHEN 'reembolso'       THEN 10
      WHEN 'cancelado'       THEN 0
      ELSE 40
    END AS r2_status_score
  FROM raw_r2 r
  LEFT JOIN r2_status_options rso ON rso.id = r.r2_status_id
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
        is_encaixado DESC,
        r2_status_score DESC,
        status_score DESC,
        scheduled_at DESC
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
  d.phone_key AS phone_dedup_key,
  -- dentro_corte: usa r1_contract_paid_at (data REAL do contrato pago no R1)
  -- com fallback para contract_paid_at do R2 quando disponível.
  CASE
    WHEN p_apply_contract_cutoff = false THEN true
    WHEN d.is_encaixado = true THEN true
    -- Contrato pago dentro da janela [start, end): conta na safra
    WHEN COALESCE(r1.r1_contract_paid_at, d.contract_paid_at) IS NOT NULL
         AND COALESCE(r1.r1_contract_paid_at, d.contract_paid_at) >= p_window_start
         AND COALESCE(r1.r1_contract_paid_at, d.contract_paid_at) < p_window_end THEN true
    -- Carry-over: contrato pago ANTES da janela, R2 dentro dela
    WHEN COALESCE(r1.r1_contract_paid_at, d.contract_paid_at) IS NOT NULL
         AND COALESCE(r1.r1_contract_paid_at, d.contract_paid_at) < p_window_start
         AND d.scheduled_at >= p_window_start
         AND d.scheduled_at < p_window_end THEN true
    -- Lead sem data de contrato registrada mas R2 dentro da janela: conta (default seguro)
    WHEN COALESCE(r1.r1_contract_paid_at, d.contract_paid_at) IS NULL
         AND d.scheduled_at >= p_window_start
         AND d.scheduled_at < p_window_end THEN true
    ELSE false
  END AS dentro_corte
FROM deduped d
LEFT JOIN r2_status_options rso ON rso.id = d.r2_status_id
LEFT JOIN closers cl ON cl.id = d.closer_id
LEFT JOIN crm_deals cd ON cd.id = d.deal_id
LEFT JOIN crm_contacts cc ON cc.id = d.contact_id
LEFT JOIN r1_data r1 ON r1.deal_id = d.deal_id
ORDER BY d.scheduled_at ASC;
$function$;