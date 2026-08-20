CREATE OR REPLACE FUNCTION public.nome_usuario(p_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(full_name, email) FROM public.profiles WHERE id = p_id;
$$;
REVOKE EXECUTE ON FUNCTION public.nome_usuario(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.nome_usuario(uuid) TO authenticated;