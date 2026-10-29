CREATE OR REPLACE FUNCTION public.pos_venda_listar_gerentes()
RETURNS TABLE(id uuid, full_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
  FROM profiles p
  WHERE public.pos_venda_tem_acesso()
    AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'gerente_relacionamento')
  ORDER BY p.full_name
$$;
REVOKE ALL ON FUNCTION public.pos_venda_listar_gerentes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_listar_gerentes() TO authenticated;