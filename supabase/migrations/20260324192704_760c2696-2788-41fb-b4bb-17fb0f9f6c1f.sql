DO $$
DECLARE
  v_origin_id UUID;
  v_stage_id UUID;
  v_rec RECORD;
  v_contact_id UUID;
  v_deal_id UUID;
  v_count INT := 0;
  v_skipped INT := 0;
BEGIN
  SELECT id INTO v_origin_id FROM crm_origins WHERE UPPER(name) = 'PIPELINE INSIDE SALES' ORDER BY created_at LIMIT 1;
  IF v_origin_id IS NULL THEN RAISE EXCEPTION 'Origin not found'; END IF;
  SELECT id INTO v_stage_id FROM crm_stages WHERE origin_id = v_origin_id AND stage_name ILIKE '%Novo Lead%' LIMIT 1;

  FOR v_rec IN (
    WITH a010_buyers AS (
      SELECT DISTINCT ON (LOWER(TRIM(customer_email)))
        LOWER(TRIM(customer_email)) as email,
        customer_name, customer_phone, sale_date, net_value, source
      FROM hubla_transactions
      WHERE product_category = 'a010' AND sale_status = 'completed'
        AND sale_date >= NOW() - INTERVAL '90 days' AND customer_email IS NOT NULL
      ORDER BY LOWER(TRIM(customer_email)), sale_date ASC
    ),
    pis_deals AS (
      SELECT DISTINCT LOWER(TRIM(c.email)) as email
      FROM crm_deals d JOIN crm_contacts c ON d.contact_id = c.id
      WHERE d.origin_id = v_origin_id AND c.email IS NOT NULL
    ),
    partners AS (
      SELECT DISTINCT LOWER(TRIM(customer_email)) as email
      FROM hubla_transactions WHERE sale_status = 'completed'
        AND (UPPER(product_name) LIKE '%A001%' OR UPPER(product_name) LIKE '%A002%' 
             OR UPPER(product_name) LIKE '%A003%' OR UPPER(product_name) LIKE '%A004%' 
             OR UPPER(product_name) LIKE '%A009%' OR UPPER(product_name) LIKE '%INCORPORADOR%' 
             OR UPPER(product_name) LIKE '%ANTICRISE%')
    )
    SELECT b.* FROM a010_buyers b
    WHERE b.email NOT IN (SELECT email FROM pis_deals)
      AND b.email NOT IN (SELECT email FROM partners)
  ) LOOP
    SELECT id INTO v_contact_id FROM crm_contacts WHERE LOWER(TRIM(email)) = v_rec.email LIMIT 1;
    
    IF v_contact_id IS NULL AND v_rec.customer_phone IS NOT NULL THEN
      SELECT id INTO v_contact_id FROM crm_contacts 
      WHERE phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(v_rec.customer_phone, '\D', '', 'g'), 9)
      LIMIT 1;
    END IF;
    
    IF v_contact_id IS NULL THEN
      INSERT INTO crm_contacts (clint_id, name, email, phone, origin_id, tags, custom_fields)
      VALUES (
        'bf-a010-sql-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 6),
        COALESCE(v_rec.customer_name, 'Cliente A010'), v_rec.email, v_rec.customer_phone,
        v_origin_id, ARRAY['A010', 'Backfill'],
        jsonb_build_object('source', COALESCE(v_rec.source, 'backfill'), 'product', 'A010')
      ) RETURNING id INTO v_contact_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM crm_deals WHERE contact_id = v_contact_id AND origin_id = v_origin_id) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    
    INSERT INTO crm_deals (clint_id, name, contact_id, origin_id, stage_id, value, tags, custom_fields, data_source)
    VALUES (
      'bf-a010-sql-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 6),
      COALESCE(v_rec.customer_name, 'Cliente') || ' - A010', v_contact_id, v_origin_id, v_stage_id,
      COALESCE(v_rec.net_value, 0), ARRAY['A010', 'Backfill'],
      jsonb_build_object('source', COALESCE(v_rec.source, 'backfill'), 'product', 'A010', 'sale_date', v_rec.sale_date::TEXT),
      'webhook'
    ) RETURNING id INTO v_deal_id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete: % deals created, % skipped (already had deal)', v_count, v_skipped;
END $$;