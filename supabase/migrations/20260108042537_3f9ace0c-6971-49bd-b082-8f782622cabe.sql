-- Remover APENAS as versões com parâmetros (TEXT, TEXT, TEXT)
-- Mantendo as versões corretas com (DATE, DATE, TEXT)

DROP FUNCTION IF EXISTS public.get_sdr_metrics_v2(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_sdr_all_movements_v2(TEXT, TEXT, TEXT);