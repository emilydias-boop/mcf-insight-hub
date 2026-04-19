CREATE OR REPLACE FUNCTION public.get_carrinho_r2_attendees(
  p_week_start date,
  p_window_start timestamp with time zone,
  p_window_end timestamp with time zone,
  p_apply_contract_cutoff boolean DEFAULT false,
  p_previous_cutoff timestamp with time zone DEFAULT NULL
)
 RETURNS TABLE(attendee_id uuid, attendee_name text, attendee_phone text, attendee_status text, r2_status_id uuid, r2_status_name text, r2_status_color text, carrinho_status text, carrinho_updated_at timestamp with time zone, carrinho_week_start date, deal_id uuid, contact_id uuid, contact_phone text, contact_email text, contact_name text, partner_name text, contract_paid_at timestamp with time zone, meeting_slot_id uuid, meeting_status text, scheduled_at timestamp with time zone, r2_closer_id uuid, r2_closer_name text, r2_closer_color text, deal_name text, r1_scheduled_at timestamp with time zone, r1_closer_name text, r1_closer_id uuid, r1_contract_paid_at timestamp with time zone, is_encaixado boolean, phone_dedup_key text, dentro_corte boolean, effective_contract_date timestamp with time zone, contract_source text)
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
),
hubla_a000 AS (
  SELECT
    RIGHT(regexp_replace(COALESCE(ht.customer_phone, ''), '\D', '', 'g'), 9) AS phone_key,
    lower(NULLIF(ht.customer_email, '')) AS email_key,
    MIN(ht.sale_date) AS first_paid_at
  FROM hubla_transactions ht
  WHERE ht.sale_status = 'completed'
    AND (ht.product_code LIKE 'A000%' OR ht.product_category = 'imersao')
  GROUP BY 1, 2
),
hubla_parceria AS (
  SELECT
    RIGHT(regexp_replace(COALESCE(ht.customer_phone, ''), '\D', '', 'g'), 9) AS phone_key,
    lower(NULLIF(ht.customer_email, '')) AS email_key,
    MIN(ht.sale_date) AS first_parceria_at
  FROM hubla_transactions ht
  WHERE ht.sale_status = 'completed'
    AND ht.product_category = 'parceria'
  GROUP BY 1, 2
),
enriched AS (
  SELECT
    d.*,
    cc.phone AS contact_phone,
    cc.email AS contact_email,
    cc.name AS contact_name,
    rso.name AS r2_status_name,
    rso.color AS r2_status_color,
    cl.name AS r2_closer_name,
    cl.color AS r2_closer_color,
    cd.name AS deal_name,
    r1.r1_scheduled_at,
    r1.r1_closer_name,
    r1.r1_closer_id,
    r1.r1_contract_paid_at,
    RIGHT(regexp_replace(COALESCE(cc.phone, d.attendee_phone, ''), '\D', '', 'g'), 9) AS hubla_phone_key,
    lower(NULLIF(cc.email, '')) AS hubla_email_key
  FROM deduped d
  LEFT JOIN r2_status_options rso ON rso.id = d.r2_status_id
  LEFT JOIN closers cl ON cl.id = d.closer_id
  LEFT JOIN crm_deals cd ON cd.id = d.deal_id
  LEFT JOIN crm_contacts cc ON cc.id = d.contact_id
  LEFT JOIN r1_data r1 ON r1.deal_id = d.deal_id
),
with_hubla AS (
  SELECT
    e.*,
    (
      SELECT MIN(ha.first_paid_at)
      FROM hubla_a000 ha
      WHERE (ha.phone_key = e.hubla_phone_key AND e.hubla_phone_key != '' AND length(e.hubla_phone_key) >= 8)
         OR (ha.email_key = e.hubla_email_key AND e.hubla_email_key IS NOT NULL)
    ) AS hubla_contract_at,
    (
      SELECT MIN(hp.first_parceria_at)
      FROM hubla_parceria hp
      WHERE (hp.phone_key = e.hubla_phone_key AND e.hubla_phone_key != '' AND length(e.hubla_phone_key) >= 8)
         OR (hp.email_key = e.hubla_email_key AND e.hubla_email_key IS NOT NULL)
    ) AS parceria_first_at
  FROM enriched e
)
SELECT
  w.id AS attendee_id,
  w.attendee_name,
  w.attendee_phone,
  w.attendee_status,
  w.r2_status_id,
  w.r2_status_name,
  w.r2_status_color,
  w.carrinho_status,
  w.carrinho_updated_at,
  w.carrinho_week_start,
  w.deal_id,
  w.contact_id,
  w.contact_phone,
  w.contact_email,
  w.contact_name,
  w.partner_name,
  w.contract_paid_at,
  w.meeting_slot_id,
  w.meeting_status,
  w.scheduled_at,
  w.closer_id AS r2_closer_id,
  w.r2_closer_name,
  w.r2_closer_color,
  w.deal_name,
  w.r1_scheduled_at,
  w.r1_closer_name,
  w.r1_closer_id,
  w.r1_contract_paid_at,
  w.is_encaixado,
  w.phone_key AS phone_dedup_key,
  CASE
    WHEN p_apply_contract_cutoff = false THEN true
    WHEN w.is_encaixado = true THEN true
    -- Cutoff efetivo: usa p_previous_cutoff (sexta anterior no corte) se fornecido, senão p_window_start
    WHEN COALESCE(w.r1_contract_paid_at, w.contract_paid_at, w.hubla_contract_at) IS NOT NULL
         AND COALESCE(w.r1_contract_paid_at, w.contract_paid_at, w.hubla_contract_at) >= COALESCE(p_previous_cutoff, p_window_start)
         AND COALESCE(w.r1_contract_paid_at, w.contract_paid_at, w.hubla_contract_at) < p_window_end THEN true
    -- Carry-over: contrato anterior ao cutoff mas R2 dentro da janela operacional (após o cutoff anterior)
    WHEN COALESCE(w.r1_contract_paid_at, w.contract_paid_at, w.hubla_contract_at) IS NOT NULL
         AND COALESCE(w.r1_contract_paid_at, w.contract_paid_at, w.hubla_contract_at) < COALESCE(p_previous_cutoff, p_window_start)
         AND w.scheduled_at >= COALESCE(p_previous_cutoff, p_window_start)
         AND w.scheduled_at < p_window_end
         AND (w.parceria_first_at IS NULL OR w.parceria_first_at >= COALESCE(p_previous_cutoff, p_window_start)) THEN true
    ELSE false
  END AS dentro_corte,
  COALESCE(w.r1_contract_paid_at, w.contract_paid_at, w.hubla_contract_at) AS effective_contract_date,
  CASE
    WHEN w.r1_contract_paid_at IS NOT NULL THEN 'r1'
    WHEN w.contract_paid_at IS NOT NULL THEN 'r2'
    WHEN w.hubla_contract_at IS NOT NULL THEN 'hubla'
    ELSE 'none'
  END AS contract_source
FROM with_hubla w
ORDER BY w.scheduled_at ASC;
$function$;