CREATE OR REPLACE FUNCTION public.upsert_deals_smart(deals_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  deal jsonb;
BEGIN
  FOR deal IN SELECT * FROM jsonb_array_elements(deals_data)
  LOOP
    INSERT INTO crm_deals (
      clint_id,
      name,
      value,
      stage_id,
      contact_id,
      origin_id,
      owner_id,
      owner_profile_id,
      tags,
      custom_fields,
      updated_at,
      created_at,
      data_source
    )
    VALUES (
      (deal->>'clint_id')::text,
      (deal->>'name')::text,
      (deal->>'value')::numeric,
      (deal->>'stage_id')::uuid,
      (deal->>'contact_id')::uuid,
      (deal->>'origin_id')::uuid,
      (deal->>'owner_id')::text,
      (deal->>'owner_profile_id')::uuid,
      CASE 
        WHEN jsonb_typeof(deal->'tags') = 'array' THEN
          (SELECT array_agg(value::text) FROM jsonb_array_elements_text(deal->'tags'))
        ELSE 
          NULL
      END::text[],
      (deal->'custom_fields')::jsonb,
      COALESCE((deal->>'updated_at')::timestamptz, NOW()),
      NOW(),
      'csv'
    )
    ON CONFLICT (clint_id) 
    DO UPDATE SET
      name = EXCLUDED.name,
      value = EXCLUDED.value,
      stage_id = EXCLUDED.stage_id,
      contact_id = EXCLUDED.contact_id,
      origin_id = EXCLUDED.origin_id,
      owner_id = EXCLUDED.owner_id,
      owner_profile_id = EXCLUDED.owner_profile_id,
      tags = EXCLUDED.tags,
      custom_fields = EXCLUDED.custom_fields,
      updated_at = EXCLUDED.updated_at,
      data_source = 'csv'
    WHERE crm_deals.data_source != 'webhook'
      AND crm_deals.updated_at < EXCLUDED.updated_at;
  END LOOP;
END;
$function$;