-- Remove old function signatures with text parameters
-- This resolves the "could not choose the best candidate function" error

-- Drop old version of get_all_hubla_transactions (text parameters)
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(
  text, text, text, integer
);

-- Drop old version of get_hubla_transactions_by_bu (text parameters)
DROP FUNCTION IF EXISTS public.get_hubla_transactions_by_bu(
  text, text, text, text, integer
);