
ALTER TABLE public.hubla_transactions 
ADD COLUMN sale_origin TEXT DEFAULT NULL;

CREATE INDEX idx_hubla_transactions_sale_origin 
ON public.hubla_transactions(sale_origin);

COMMENT ON COLUMN public.hubla_transactions.sale_origin IS 'Origin of sale: launch, closer, direct, outside, or NULL (uncategorized)';
