
-- Parte 1: Criar deals no Inside Sales para compradores A010 recentes (abril)
INSERT INTO crm_deals (clint_id, name, contact_id, origin_id, stage_id, value, tags, custom_fields, data_source)
SELECT 
  'backfill-a010-' || gen_random_uuid()::text,
  c.name || ' - A010',
  d.contact_id,
  'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b',
  COALESCE((
    SELECT ht.net_value FROM hubla_transactions ht 
    WHERE ht.customer_email ILIKE c.email 
      AND ht.product_category = 'a010' 
      AND ht.sale_status = 'completed'
    ORDER BY ht.sale_date DESC LIMIT 1
  ), 0),
  ARRAY['A010', 'recuperado-a010'],
  jsonb_build_object('source', 'backfill', 'product', 'A010 - MCF Fundamentos', 'backfilled_at', now()::text),
  'webhook'
FROM crm_deals d
JOIN crm_contacts c ON c.id = d.contact_id
WHERE d.origin_id = '4e2b810a-6782-4ce9-9c0d-10d04c018636'
  AND d.created_at >= '2026-03-01'
  AND EXISTS (
    SELECT 1 FROM hubla_transactions ht 
    WHERE ht.customer_email ILIKE c.email 
      AND ht.product_category = 'a010' 
      AND ht.sale_status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM crm_deals d2 
    WHERE d2.contact_id = d.contact_id 
      AND d2.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
  );
