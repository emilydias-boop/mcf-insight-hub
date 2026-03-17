-- Remove a versão antiga com parâmetros text que causava o overload ambíguo (PGRST203)
-- A versão com parâmetros date (criada em 20260317222312) permanece ativa
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(text, text, text);