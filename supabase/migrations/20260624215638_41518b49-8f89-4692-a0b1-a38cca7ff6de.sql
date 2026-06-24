CREATE OR REPLACE FUNCTION public.get_consorcio_commission_summary(p_card_ids uuid[])
RETURNS TABLE (
  comissao_total numeric,
  comissao_recebida numeric,
  comissao_pendente numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(valor_comissao), 0)::numeric AS comissao_total,
    COALESCE(SUM(valor_comissao) FILTER (WHERE status = 'pago'), 0)::numeric AS comissao_recebida,
    COALESCE(SUM(valor_comissao) FILTER (WHERE status IS DISTINCT FROM 'pago'), 0)::numeric AS comissao_pendente
  FROM public.consortium_installments
  WHERE card_id = ANY(p_card_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_consorcio_commission_summary(uuid[]) TO authenticated, service_role;