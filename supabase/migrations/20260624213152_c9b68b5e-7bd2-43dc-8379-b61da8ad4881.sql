CREATE OR REPLACE FUNCTION public.get_outside_detection_for_deals(p_deal_ids uuid[])
 RETURNS TABLE(deal_id uuid, is_outside boolean, product_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_outside_offers text[] := ARRAY[
    'contrato - curso r$ 97,00',
    'contrato perfil a - vitrine a010',
    'a000 - contrato mcf - construir pra alugar'
  ];
BEGIN
  RETURN QUERY
  WITH
  input_deals AS (
    SELECT d.id AS deal_id, lower(trim(c.email)) AS email
    FROM crm_deals d
    JOIN crm_contacts c ON c.id = d.contact_id
    WHERE d.id = ANY(p_deal_ids)
      AND c.email IS NOT NULL
      AND trim(c.email) <> ''
  ),
  emails AS (
    SELECT DISTINCT id2.email FROM input_deals id2
  ),
  sibling_deals AS (
    SELECT d.id AS deal_id, lower(trim(c.email)) AS email
    FROM crm_deals d
    JOIN crm_contacts c ON c.id = d.contact_id
    WHERE lower(trim(c.email)) IN (SELECT e.email FROM emails e)
  ),
  all_deal_ids AS (
    SELECT id3.deal_id FROM input_deals id3
    UNION
    SELECT sd2.deal_id FROM sibling_deals sd2
  ),
  partner_emails AS (
    SELECT DISTINCT ht.customer_email AS email
    FROM hubla_transactions ht
    WHERE ht.customer_email IN (SELECT e.email FROM emails e)
      AND ht.sale_status = 'completed'
      AND (
        ht.product_name ILIKE '%A001%'
        OR ht.product_name ILIKE '%A002%'
        OR ht.product_name ILIKE '%A003%'
        OR ht.product_name ILIKE '%A004%'
        OR ht.product_name ILIKE '%A009%'
        OR ht.product_name ILIKE '%INCORPORADOR%'
        OR ht.product_name ILIKE '%ANTICRISE%'
      )
  ),
  cls_emails AS (
    SELECT DISTINCT ht.customer_email AS email
    FROM hubla_transactions ht
    WHERE ht.customer_email IN (SELECT e.email FROM emails e)
      AND ht.sale_status = 'completed'
      AND ht.offer_name ILIKE 'Contrato CLS%'
  ),
  raw_contracts AS (
    SELECT
      ht.customer_email AS email,
      ht.sale_date,
      ht.product_name,
      ht.offer_name,
      ht.linked_attendee_id
    FROM hubla_transactions ht
    WHERE ht.customer_email IN (SELECT e.email FROM emails e)
      AND ht.product_category IN ('contrato', 'incorporador')
      AND ht.product_name ILIKE '%contrato%'
      AND ht.sale_status = 'completed'
      AND ht.offer_name IS NOT NULL
      AND lower(trim(ht.offer_name)) = ANY(v_outside_offers)
  ),
  contracts AS (
    SELECT
      rc.email,
      rc.sale_date,
      rc.product_name,
      rc.linked_attendee_id,
      msa.deal_id AS linked_deal_id
    FROM raw_contracts rc
    LEFT JOIN meeting_slot_attendees msa ON msa.id = rc.linked_attendee_id
  ),
  non_contract_names AS (
    SELECT DISTINCT ON (ht.customer_email)
      ht.customer_email AS email,
      ht.product_name
    FROM hubla_transactions ht
    WHERE ht.customer_email IN (SELECT e.email FROM emails e)
      AND ht.sale_status = 'completed'
      AND ht.product_name IS NOT NULL
      AND ht.product_name NOT ILIKE '%contrato%'
    ORDER BY ht.customer_email, ht.sale_date DESC
  ),
  contract_display AS (
    SELECT DISTINCT ON (cc.email) cc.email, cc.product_name
    FROM contracts cc
    ORDER BY cc.email, cc.sale_date ASC
  ),
  r1_per_deal AS (
    SELECT msa.deal_id, MIN(ms.scheduled_at) AS r1_at
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    WHERE msa.deal_id IN (SELECT adi.deal_id FROM all_deal_ids adi)
      AND ms.meeting_type = 'r1'
    GROUP BY msa.deal_id
  ),
  r1_per_email AS (
    SELECT sd.email, MIN(rpd.r1_at) AS r1_at
    FROM sibling_deals sd
    JOIN r1_per_deal rpd ON rpd.deal_id = sd.deal_id
    GROUP BY sd.email
  ),
  effective_r1 AS (
    SELECT
      id4.deal_id,
      LEAST(
        rpd.r1_at,
        rpe.r1_at
      ) AS r1_at
    FROM input_deals id4
    LEFT JOIN r1_per_deal rpd ON rpd.deal_id = id4.deal_id
    LEFT JOIN r1_per_email rpe ON rpe.email = id4.email
  ),
  email_has_linked AS (
    SELECT cc.email, bool_or(cc.linked_deal_id IS NOT NULL) AS has_linked
    FROM contracts cc
    GROUP BY cc.email
  ),
  deal_contracts AS (
    SELECT
      id5.deal_id,
      id5.email,
      c.sale_date,
      c.product_name,
      c.linked_deal_id
    FROM input_deals id5
    JOIN contracts c ON c.email = id5.email
    LEFT JOIN email_has_linked ehl ON ehl.email = id5.email
    WHERE NOT (COALESCE(ehl.has_linked, false) AND c.linked_deal_id IS NULL)
      AND (c.linked_deal_id IS NULL OR c.linked_deal_id = id5.deal_id)
  ),
  earliest_contract AS (
    SELECT DISTINCT ON (dc.deal_id)
      dc.deal_id, dc.email, dc.sale_date
    FROM deal_contracts dc
    ORDER BY dc.deal_id, dc.sale_date ASC
  )
  SELECT
    ec.deal_id,
    true AS is_outside,
    COALESCE(ncn.product_name, cd.product_name) AS product_name
  FROM earliest_contract ec
  LEFT JOIN non_contract_names ncn ON ncn.email = ec.email
  LEFT JOIN contract_display cd ON cd.email = ec.email
  LEFT JOIN effective_r1 er ON er.deal_id = ec.deal_id
  WHERE ec.email NOT IN (SELECT pe.email FROM partner_emails pe)
    AND ec.email NOT IN (SELECT ce.email FROM cls_emails ce)
    AND (
      er.r1_at IS NULL
      OR ec.sale_date <= er.r1_at
    );
END;
$function$;