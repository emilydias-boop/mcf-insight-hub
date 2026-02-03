-- Função que injeta roles no JWT (Custom Access Token Hook)
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_roles text[];
BEGIN
  -- Busca todas as roles do usuário
  SELECT array_agg(role::text) INTO user_roles
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  -- Pega as claims existentes
  claims := event->'claims';
  
  -- Adiciona roles ao token (array vazio se não tiver roles)
  claims := jsonb_set(claims, '{user_roles}', to_jsonb(COALESCE(user_roles, ARRAY[]::text[])));
  
  -- Retorna o evento com as claims modificadas
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Permissões necessárias para o serviço de auth
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revogar acesso do public e anon (segurança)
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;