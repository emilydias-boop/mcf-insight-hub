CREATE OR REPLACE FUNCTION public.list_transferable_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role app_role,
  squad text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  is_priv boolean;
  caller_squad text[];
BEGIN
  IF caller IS NULL THEN
    RETURN;
  END IF;

  is_priv := has_role(caller, 'admin'::app_role)
          OR has_role(caller, 'manager'::app_role)
          OR has_role(caller, 'coordenador'::app_role);

  SELECT p.squad INTO caller_squad FROM public.profiles p WHERE p.id = caller;

  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id,
    p.email,
    p.full_name,
    ur.role,
    p.squad
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('sdr','closer','closer_sombra','coordenador','manager','admin')
    AND COALESCE(p.access_status, 'ativo') NOT IN ('desativado','blocked','inativo','inactive')
    AND (
      is_priv
      OR (
        caller_squad IS NOT NULL
        AND p.squad IS NOT NULL
        AND p.squad && caller_squad
      )
    )
  ORDER BY p.id, ur.role;
END;
$$;