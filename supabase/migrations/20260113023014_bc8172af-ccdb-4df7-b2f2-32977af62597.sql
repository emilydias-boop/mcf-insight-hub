-- Remove the ambiguous overload with timestamp without time zone
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamp without time zone, timestamp without time zone, integer);

-- Ensure grants are in place for the remaining timestamptz version
GRANT EXECUTE ON FUNCTION public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer) TO anon, authenticated;