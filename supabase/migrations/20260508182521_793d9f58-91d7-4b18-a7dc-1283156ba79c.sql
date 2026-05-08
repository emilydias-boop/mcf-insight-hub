
ALTER TABLE public.sdr_squad_history
  ADD COLUMN IF NOT EXISTS role_type text NOT NULL DEFAULT 'sdr';

ALTER TABLE public.sdr_squad_history
  DROP CONSTRAINT IF EXISTS sdr_squad_history_role_type_check;
ALTER TABLE public.sdr_squad_history
  ADD CONSTRAINT sdr_squad_history_role_type_check
  CHECK (role_type IN ('sdr','closer'));

-- Backfill: usa o role_type atual do sdr para histórico já existente
UPDATE public.sdr_squad_history h
SET role_type = COALESCE(s.role_type, 'sdr')
FROM public.sdr s
WHERE h.sdr_id = s.id
  AND h.role_type = 'sdr';

-- Recoloca Marcio Dantas no Incorporador como Closer (16/03 → 08/05/2026)
INSERT INTO public.sdr_squad_history (sdr_id, squad, role_type, valid_from, valid_to)
VALUES (
  '1b949ca6-c97d-4a01-8da9-105dca5ded86',
  'incorporador',
  'closer',
  '2026-03-16 00:00:00+00',
  '2026-05-08 13:24:14.665244+00'
)
ON CONFLICT DO NOTHING;

-- Atualiza função: filtra role_type no histórico, não no SDR atual
CREATE OR REPLACE FUNCTION public.get_sdrs_for_squad_in_period(
  p_squad text, p_start timestamp with time zone, p_end timestamp with time zone
)
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
  WHERE s.active = true
    AND h.squad = p_squad
    AND h.role_type = 'sdr'
    AND h.valid_from <= p_end
    AND COALESCE(
          h.valid_to,
          CASE WHEN e.data_demissao IS NOT NULL
               THEN (e.data_demissao::timestamptz + INTERVAL '1 day')
               ELSE 'infinity'::timestamptz
          END
        ) >= p_start
    AND (e.data_demissao IS NULL OR e.data_demissao >= p_start::date)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = s.user_id
        AND ur.role IN ('admin','manager','coordenador','assistente_administrativo')
    );
$function$;
