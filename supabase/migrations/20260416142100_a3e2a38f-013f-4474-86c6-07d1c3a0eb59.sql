
-- Pass 1: Deduplicar por email (sem alterar contact_id)
WITH inside_sales_origin AS (
  SELECT id FROM crm_origins WHERE name = 'PIPELINE INSIDE SALES' LIMIT 1
),
deals_with_info AS (
  SELECT
    d.id AS deal_id,
    lower(trim(c.email)) AS email_norm,
    s.stage_order,
    d.created_at
  FROM crm_deals d
  JOIN crm_contacts c ON c.id = d.contact_id
  JOIN crm_stages s ON s.id = d.stage_id
  WHERE d.origin_id = (SELECT id FROM inside_sales_origin)
    AND d.is_duplicate = false
    AND d.archived_at IS NULL
),
email_groups AS (
  SELECT
    email_norm,
    deal_id,
    ROW_NUMBER() OVER (
      PARTITION BY email_norm
      ORDER BY stage_order DESC, created_at DESC
    ) AS rn
  FROM deals_with_info
  WHERE email_norm IS NOT NULL AND email_norm <> ''
),
email_losers AS (
  SELECT deal_id FROM email_groups WHERE rn > 1
)
UPDATE crm_deals
SET is_duplicate = true, archived_at = now()
FROM email_losers el
WHERE crm_deals.id = el.deal_id;

-- Pass 2: Deduplicar sobreviventes por phone suffix (9 dígitos)
WITH inside_sales_origin AS (
  SELECT id FROM crm_origins WHERE name = 'PIPELINE INSIDE SALES' LIMIT 1
),
surviving_deals AS (
  SELECT
    d.id AS deal_id,
    RIGHT(regexp_replace(c.phone, '\D', '', 'g'), 9) AS phone_suffix,
    s.stage_order,
    d.created_at
  FROM crm_deals d
  JOIN crm_contacts c ON c.id = d.contact_id
  JOIN crm_stages s ON s.id = d.stage_id
  WHERE d.origin_id = (SELECT id FROM inside_sales_origin)
    AND d.is_duplicate = false
    AND d.archived_at IS NULL
),
phone_groups AS (
  SELECT
    phone_suffix,
    deal_id,
    ROW_NUMBER() OVER (
      PARTITION BY phone_suffix
      ORDER BY stage_order DESC, created_at DESC
    ) AS rn
  FROM surviving_deals
  WHERE phone_suffix IS NOT NULL
    AND phone_suffix <> ''
    AND length(phone_suffix) >= 8
),
phone_losers AS (
  SELECT deal_id FROM phone_groups WHERE rn > 1
)
UPDATE crm_deals
SET is_duplicate = true, archived_at = now()
FROM phone_losers pl
WHERE crm_deals.id = pl.deal_id;
