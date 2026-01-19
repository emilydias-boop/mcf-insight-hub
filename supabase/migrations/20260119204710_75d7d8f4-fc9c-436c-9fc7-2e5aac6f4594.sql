-- Remove the overloaded TEXT version of the function to resolve PGRST203 ambiguity
DROP FUNCTION IF EXISTS public.get_sdr_meetings_from_agenda(text, text, text);