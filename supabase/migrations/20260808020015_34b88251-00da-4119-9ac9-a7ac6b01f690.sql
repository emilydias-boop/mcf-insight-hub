CREATE OR REPLACE FUNCTION public.oi_is_venda_produto(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(p_name,'') !~* '^\s*A000' AND coalesce(p_name,'') <> 'Contrato' AND (
    coalesce(p_name,'') ~* '^\s*A00[1-9]'
    OR coalesce(p_name,'') ILIKE '%MCF INCORPORADOR%'
    OR coalesce(p_name,'') ILIKE '%ANTICRISE%'
    OR coalesce(p_name,'') ILIKE '%THE CLUB%'
    OR coalesce(p_name,'') ILIKE '%MCF P2%'
    OR coalesce(p_name,'') ILIKE '%PLANO CONSTRUTOR%'
  )
$$;

REVOKE ALL ON FUNCTION public.oi_is_venda_produto(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oi_is_venda_produto(text) TO service_role;