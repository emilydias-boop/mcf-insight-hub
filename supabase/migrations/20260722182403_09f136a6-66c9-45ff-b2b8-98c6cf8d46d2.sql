DROP TRIGGER IF EXISTS trg_hubla_to_ar ON public.hubla_transactions;
CREATE TRIGGER trg_hubla_to_ar
AFTER INSERT OR UPDATE ON public.hubla_transactions
FOR EACH ROW EXECUTE FUNCTION public.ar_create_from_hubla();

UPDATE public.hubla_transactions h
SET updated_at = now()
WHERE coalesce(h.sale_status,'') IN ('completed','paid')
  AND public.ar_extract_product_code(h.product_name) = ANY(ARRAY['A000','A001','A002','A003','A004','A009'])
  AND NOT EXISTS (SELECT 1 FROM public.ar_titulos a WHERE a.hubla_transaction_id = h.id);