CREATE OR REPLACE FUNCTION public.get_sdrs_for_squad_in_period(p_squad text, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS TABLE(sdr_id uuid, email text, name text, current_squad text, was_in_squad_during_period boolean, is_currently_in_squad boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    s.id AS sdr_id,
    s.email,
    s.name,
    s.squad AS current_squad,
    TRUE AS was_in_squad_during_period,
    (s.squad = p_squad AND s.active = true) AS is_currently_in_squad
  FROM public.sdr s
  INNER JOIN public.sdr_squad_history h ON h.sdr_id = s.id
  WHERE s.role_type = 'sdr'
    AND s.active = true
    AND h.squad = p_squad
    AND h.valid_from <= p_end
    AND COALESCE(h.valid_to, 'infinity'::timestamptz) >= p_start
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = s.user_id
        AND ur.role IN ('admin','manager','coordenador','assistente_administrativo')
    );
$function$;