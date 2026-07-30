CREATE OR REPLACE FUNCTION public.get_outside_offer_backfill_pending(p_since timestamptz DEFAULT (now() - interval '30 days'))
RETURNS TABLE (
  customer_email text,
  customer_name text,
  customer_phone text,
  first_sale_date timestamptz,
  offer_label text,
  contact_id uuid,
  deal_id uuid,
  origin_name text,
  stage_name text,
  tags text[],
  owner_id text,
  motivo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH buyers AS (
    SELECT lower(trim(ht.customer_email)) AS email,
           max(ht.customer_name) AS nome,
           max(ht.customer_phone) AS fone,
           min(ht.sale_date) AS dt,
           max(coalesce(ht.offer_name, ht.offer_id)) AS offer_label
    FROM hubla_transactions ht
    JOIN outside_offers oo
      ON oo.is_active
     AND (
          (oo.offer_id IS NOT NULL AND oo.offer_id = ht.offer_id)
       OR (oo.offer_name IS NOT NULL AND lower(trim(oo.offer_name)) = lower(trim(ht.offer_name)))
     )
    WHERE ht.sale_status = 'completed'
      AND ht.product_name ILIKE '%contrato%'
      AND ht.sale_date >= p_since
      AND ht.customer_email IS NOT NULL
    GROUP BY 1
  ),
  disq AS (
    SELECT DISTINCT lower(trim(customer_email)) AS email
    FROM hubla_transactions
    WHERE sale_status = 'completed'
      AND (
        product_name ILIKE '%A001%' OR product_name ILIKE '%A002%' OR product_name ILIKE '%A003%'
        OR product_name ILIKE '%A004%' OR product_name ILIKE '%A009%'
        OR product_name ILIKE '%INCORPORADOR%' OR product_name ILIKE '%ANTICRISE%'
        OR offer_name ILIKE 'Contrato CLS%'
      )
  ),
  matched AS (
    SELECT b.*, c.id AS contact_id
    FROM buyers b
    LEFT JOIN LATERAL (
      SELECT c1.id
      FROM crm_contacts c1
      WHERE lower(trim(c1.email)) = b.email
         OR (length(regexp_replace(coalesce(b.fone,''), '\D', '', 'g')) >= 10
             AND c1.phone LIKE '%' || right(regexp_replace(b.fone, '\D', '', 'g'), 9))
      ORDER BY (lower(trim(c1.email)) = b.email) DESC, c1.created_at ASC
      LIMIT 1
    ) c ON true
    WHERE b.email NOT IN (SELECT email FROM disq)
  )
  SELECT m.email,
         m.nome,
         m.fone,
         m.dt,
         m.offer_label,
         m.contact_id,
         d.id,
         o.name,
         st.stage_name,
         d.tags,
         d.owner_id,
         CASE
           WHEN m.contact_id IS NULL THEN 'sem contato no CRM'
           WHEN d.id IS NULL THEN 'sem deal em Inside Sales'
           WHEN NOT ('Outside' = ANY(coalesce(d.tags, '{}'))) THEN 'sem tag Outside'
           ELSE 'fora da etapa Contrato Pago'
         END
  FROM matched m
  LEFT JOIN LATERAL (
    SELECT d1.*
    FROM crm_deals d1
    JOIN crm_origins o1 ON o1.id = d1.origin_id
    WHERE d1.contact_id = m.contact_id
      AND lower(o1.name) = 'pipeline inside sales'
    ORDER BY d1.created_at ASC
    LIMIT 1
  ) d ON true
  LEFT JOIN crm_origins o ON o.id = d.origin_id
  LEFT JOIN crm_stages st ON st.id = d.stage_id
  WHERE d.id IS NULL
     OR NOT ('Outside' = ANY(coalesce(d.tags, '{}')))
     OR st.stage_name IS DISTINCT FROM 'Contrato Pago'
  ORDER BY m.dt;
$$;

REVOKE ALL ON FUNCTION public.get_outside_offer_backfill_pending(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_outside_offer_backfill_pending(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_outside_offer_backfill_pending(timestamptz) TO service_role;