
-- Adicionar 'replication' à constraint de data_source
ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_data_source_check;

ALTER TABLE crm_deals ADD CONSTRAINT crm_deals_data_source_check 
CHECK (data_source = ANY (ARRAY['csv'::text, 'webhook'::text, 'manual'::text, 'bubble'::text, 'replication'::text]));
