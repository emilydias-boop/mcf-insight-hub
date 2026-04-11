UPDATE hubla_transactions
SET offer_name = raw_data->'event'->'products'->0->'offers'->0->>'name'
WHERE offer_name IS NULL
AND raw_data->'event'->'products'->0->'offers'->0->>'name' IS NOT NULL;