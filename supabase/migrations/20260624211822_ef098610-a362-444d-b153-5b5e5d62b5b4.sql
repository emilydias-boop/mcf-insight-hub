
CREATE OR REPLACE FUNCTION public.get_outside_detection_for_deals(p_deal_ids uuid[])
RETURNS TABLE(deal_id uuid, is_outside boolean, product_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    SELECT DISTINCT email FROM input_deals
  ),
  sibling_deals AS (
    SELECT d.id AS deal_id, lower(trim(c.email)) AS email
    FROM crm_deals d
    JOIN crm_contacts c ON c.id = d.contact_id
    WHERE lower(trim(c.email)) IN (SELECT email FROM emails)
  ),
  all_deal_ids AS (
    SELECT deal_id FROM input_deals
    UNION
    SELECT deal_id FROM sibling_deals
  ),
  partner_emails AS (
    SELECT DISTINCT ht.customer_email AS email
    FROM hubla_transactions ht
    WHERE ht.customer_email IN (SELECT email FROM emails)
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
    WHERE ht.customer_email IN (SELECT email FROM emails)
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
    WHERE ht.customer_email IN (SELECT email FROM emails)
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
    WHERE ht.customer_email IN (SELECT email FROM emails)
      AND ht.sale_status = 'completed'
      AND ht.product_name IS NOT NULL
      AND ht.product_name NOT ILIKE '%contrato%'
    ORDER BY ht.customer_email, ht.sale_date DESC
  ),
  contract_display AS (
    SELECT DISTINCT ON (email) email, product_name
    FROM contracts
    ORDER BY email, sale_date ASC
  ),
  r1_per_deal AS (
    SELECT msa.deal_id, MIN(ms.scheduled_at) AS r1_at
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    WHERE msa.deal_id IN (SELECT deal_id FROM all_deal_ids)
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
      id.deal_id,
      LEAST(
        rpd.r1_at,
        rpe.r1_at
      ) AS r1_at
    FROM input_deals id
    LEFT JOIN r1_per_deal rpd ON rpd.deal_id = id.deal_id
    LEFT JOIN r1_per_email rpe ON rpe.email = id.email
  ),
  email_has_linked AS (
    SELECT email, bool_or(linked_deal_id IS NOT NULL) AS has_linked
    FROM contracts
    GROUP BY email
  ),
  deal_contracts AS (
    SELECT
      id.deal_id,
      id.email,
      c.sale_date,
      c.product_name,
      c.linked_deal_id
    FROM input_deals id
    JOIN contracts c ON c.email = id.email
    LEFT JOIN email_has_linked ehl ON ehl.email = id.email
    WHERE NOT (COALESCE(ehl.has_linked, false) AND c.linked_deal_id IS NULL)
      AND (c.linked_deal_id IS NULL OR c.linked_deal_id = id.deal_id)
  ),
  earliest_contract AS (
    SELECT DISTINCT ON (deal_id)
      deal_id, email, sale_date
    FROM deal_contracts
    ORDER BY deal_id, sale_date ASC
  )
  SELECT
    ec.deal_id,
    true AS is_outside,
    COALESCE(ncn.product_name, cd.product_name) AS product_name
  FROM earliest_contract ec
  LEFT JOIN non_contract_names ncn ON ncn.email = ec.email
  LEFT JOIN contract_display cd ON cd.email = ec.email
  LEFT JOIN effective_r1 er ON er.deal_id = ec.deal_id
  WHERE ec.email NOT IN (SELECT email FROM partner_emails)
    AND ec.email NOT IN (SELECT email FROM cls_emails)
    AND (
      er.r1_at IS NULL
      OR ec.sale_date <= er.r1_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_outside_detection_for_deals(uuid[]) TO authenticated, service_role;
