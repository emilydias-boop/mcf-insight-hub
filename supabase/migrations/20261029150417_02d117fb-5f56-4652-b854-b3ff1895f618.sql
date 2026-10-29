CREATE OR REPLACE FUNCTION public.pos_venda_tem_acesso()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente_relacionamento')
    OR EXISTS (
      SELECT 1 FROM public.sdr s
      WHERE s.user_id = auth.uid()
        AND 'b05a0000-0000-4000-8000-000000000002' = ANY(s.allowed_origin_ids::text[])
    )
$function$;