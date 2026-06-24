CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_hubla_transactions_customer_email
  ON public.hubla_transactions (customer_email);

CREATE INDEX IF NOT EXISTS idx_hubla_transactions_customer_phone
  ON public.hubla_transactions (customer_phone);

CREATE INDEX IF NOT EXISTS idx_hubla_transactions_product_name_trgm
  ON public.hubla_transactions USING gin (product_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_hubla_transactions_offer_name_trgm
  ON public.hubla_transactions USING gin (offer_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_crm_deals_product_name
  ON public.crm_deals (product_name);

CREATE INDEX IF NOT EXISTS idx_calls_origin_id
  ON public.calls (origin_id);