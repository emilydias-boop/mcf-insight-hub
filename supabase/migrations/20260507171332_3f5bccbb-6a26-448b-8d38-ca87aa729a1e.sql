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
    (s.squad = p_squad AND s.active = true
       AND NOT EXISTS (
         SELECT 1 FROM public.employees e2
         WHERE e2.sdr_id = s.id
           AND (e2.status = 'desligado' OR e2.data_demissao IS NOT NULL)
       )
    ) AS is_currently_in_squad
  FROM public.sdr s
  INNER JOIN public.sdr_squad_history h ON h.sdr_id = s.id
  LEFT JOIN public.employees e ON e.sdr_id = s.id
  WHERE s.role_type = 'sdr'
    AND s.active = true
    AND h.squad = p_squad
    AND h.valid_from <= p_end
    AND COALESCE(
          h.valid_to,
          CASE WHEN e.data_demissao IS NOT NULL
               THEN (e.data_demissao::timestamptz + INTERVAL '1 day')
               ELSE 'infinity'::timestamptz
          END
        ) >= p_start
    -- Excluir quem já estava desligado antes do período começar
    AND (e.data_demissao IS NULL OR e.data_demissao >= p_start::date)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = s.user_id
        AND ur.role IN ('admin','manager','coordenador','assistente_administrativo')
    );
$function$;