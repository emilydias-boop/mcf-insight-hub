-- Remover constraint antiga
ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_data_source_check;

-- Adicionar constraint com 'bubble' incluído
ALTER TABLE crm_deals ADD CONSTRAINT crm_deals_data_source_check 
  CHECK (data_source = ANY (ARRAY['csv'::text, 'webhook'::text, 'manual'::text, 'bubble'::text]));