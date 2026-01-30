-- Remove the old version with text parameters to resolve function overloading ambiguity
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer);