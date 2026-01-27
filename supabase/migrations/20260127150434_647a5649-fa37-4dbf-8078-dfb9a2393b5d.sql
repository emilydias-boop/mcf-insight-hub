-- Remove function overloads that use timestamp with time zone to eliminate PGRST203 ambiguity
-- Keep only the text versions which the frontend already uses

DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer);

DROP FUNCTION IF EXISTS public.get_hubla_transactions_by_bu(text, text, timestamp with time zone, timestamp with time zone, integer);