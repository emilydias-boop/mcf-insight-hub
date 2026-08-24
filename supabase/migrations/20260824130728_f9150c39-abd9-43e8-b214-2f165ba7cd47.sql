CREATE OR REPLACE FUNCTION public.can_access_consorcio_pii(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (ARRAY[
        'admin','manager','coordenador','closer','closer_sombra',
        'sdr','financeiro','gr','assistente_administrativo','cobranca_consorcio'
      ]::app_role[])
  )
  OR EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = _user_id
      AND up.resource = 'crm'
      AND up.permission_level <> 'none'
  )
$function$;