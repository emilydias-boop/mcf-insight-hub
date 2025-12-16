-- Corrigir customer_name/email/phone nos registros existentes usando raw_data

-- 1. Corrigir NewSale (userName/userEmail/userPhone)
UPDATE hubla_transactions 
SET 
  customer_name = COALESCE(
    raw_data->'event'->>'userName',
    raw_data->>'userName',
    customer_name
  ),
  customer_email = COALESCE(
    raw_data->'event'->>'userEmail',
    raw_data->>'userEmail',
    customer_email
  ),
  customer_phone = COALESCE(
    raw_data->'event'->>'userPhone',
    raw_data->>'userPhone',
    customer_phone
  ),
  updated_at = NOW()
WHERE event_type = 'NewSale' 
  AND (customer_name IS NULL OR customer_name = '');

-- 2. Corrigir invoice.payment_succeeded (payer firstName/lastName)
UPDATE hubla_transactions 
SET 
  customer_name = COALESCE(
    NULLIF(TRIM(CONCAT(
      COALESCE(raw_data->'event'->'invoice'->'payer'->>'firstName', ''), 
      ' ', 
      COALESCE(raw_data->'event'->'invoice'->'payer'->>'lastName', '')
    )), ''),
    raw_data->'event'->'user'->>'name',
    customer_name
  ),
  customer_email = COALESCE(
    raw_data->'event'->'invoice'->'payer'->>'email',
    raw_data->'event'->'user'->>'email',
    customer_email
  ),
  customer_phone = COALESCE(
    raw_data->'event'->'invoice'->'payer'->>'phone',
    raw_data->'event'->'user'->>'phone',
    customer_phone
  ),
  updated_at = NOW()
WHERE event_type = 'invoice.payment_succeeded' 
  AND (customer_name IS NULL OR customer_name = '');