ALTER TABLE public.crm_deals DROP CONSTRAINT IF EXISTS crm_deals_data_source_check;
ALTER TABLE public.crm_deals ADD CONSTRAINT crm_deals_data_source_check
CHECK (data_source = ANY (ARRAY['csv'::text, 'webhook'::text, 'manual'::text, 'bubble'::text, 'replication'::text, 'pos_venda_encaminhamento'::text]));