-- Atualizar owner_id retroativamente baseado em custom_fields.deal_user
UPDATE crm_deals 
SET owner_id = custom_fields->>'deal_user'
WHERE owner_id IS NULL 
  AND custom_fields->>'deal_user' IS NOT NULL 
  AND custom_fields->>'deal_user' != '';