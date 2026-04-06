
CREATE OR REPLACE FUNCTION public.get_a010_orphan_emails(
  p_origin_id uuid,
  p_since timestamptz,
  p_limit int DEFAULT 50
)
RETURNS TABLE(email text, contact_id uuid, contact_name text, contact_phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (lower(ht.customer_email))
    lower(ht.customer_email) as email,
    c.id as contact_id,
    c.name as contact_name,
    c.phone as contact_phone
  FROM hubla_transactions ht
  JOIN crm_contacts c 
    ON lower(c.email) = lower(ht.customer_email) 
    AND c.is_archived = false
  WHERE ht.product_category = 'a010'
    AND ht.sale_status = 'completed'
    AND ht.created_at >= p_since
    AND ht.customer_email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 
      FROM crm_deals d
      JOIN crm_contacts c2 ON c2.id = d.contact_id
      WHERE d.origin_id = p_origin_id
        AND lower(c2.email) = lower(ht.customer_email)
    )
  ORDER BY lower(ht.customer_email), c.created_at ASC
  LIMIT p_limit;
$$;
