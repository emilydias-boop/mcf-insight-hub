-- Drop the old function with DATE parameters to resolve overloading conflict
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(date, date, text);