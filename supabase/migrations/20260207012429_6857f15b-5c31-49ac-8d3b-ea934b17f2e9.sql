-- Remover a versão antiga da função (com timestamp with time zone)
-- Manter apenas a versão com TEXT que é mais recente e inclui reference_price
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(
  p_search text,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_limit integer,
  p_products text[]
);