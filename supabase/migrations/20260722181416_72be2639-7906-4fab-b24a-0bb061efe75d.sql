-- Fix product code extraction: previously returned only the digits ("003") instead of full code ("A003"),
-- causing the ar_create_from_hubla trigger to skip creating títulos for A000/A001/A002/A003/A004/A009 sales.
CREATE OR REPLACE FUNCTION public.ar_extract_product_code(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT UPPER(substring(coalesce(p_name,'') FROM '^([Aa][0-9]{3})'));
$function$;

-- Backfill: re-fire the trigger for completed Hubla transactions of A000-A004/A009 that never produced ar_titulos
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT h.id
    FROM public.hubla_transactions h
    LEFT JOIN public.ar_titulos a ON a.hubla_transaction_id = h.id
    WHERE coalesce(h.sale_status,'') IN ('completed','paid')
      AND public.ar_extract_product_code(h.product_name) = ANY(ARRAY['A000','A001','A002','A003','A004','A009'])
      AND a.id IS NULL
  LOOP
    UPDATE public.hubla_transactions SET updated_at = now() WHERE id = r.id;
  END LOOP;
END $$;