CREATE OR REPLACE FUNCTION public.call_is_visible(_user_id uuid, _created_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _created_at IS NULL OR _created_at < '2026-08-14 01:36:04+00'::timestamptz THEN true
    WHEN _user_id IS NULL THEN true
    -- Closers (incl. hibridos SDR+Closer) seguem usando Twilio: nunca filtrados
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role IN ('closer'::app_role, 'closer_sombra'::app_role)
    ) THEN true
    -- SDRs migrados para Sonax: ligacoes Twilio pos-corte ficam ocultas
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id AND ur.role = 'sdr'::app_role
    ) THEN false
    ELSE true
  END;
$$;

GRANT EXECUTE ON FUNCTION public.call_is_visible(uuid, timestamptz) TO authenticated, anon, service_role;

DROP POLICY IF EXISTS "Users can view their own calls" ON public.calls;
CREATE POLICY "Users can view their own calls"
ON public.calls
FOR SELECT
USING (
  (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
  )
  AND public.call_is_visible(user_id, created_at)
);

CREATE OR REPLACE FUNCTION public.get_sdr_call_daily_summary(p_sdr_user_id uuid, p_start date, p_end date)
 RETURNS TABLE(day date, attempts integer, effective integer, qualified integer, total_seconds integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      (COALESCE(c.started_at, c.created_at) AT TIME ZONE 'America/Sao_Paulo')::date AS day,
      COALESCE(c.duration_seconds, 0) AS dur,
      c.status,
      c.outcome
    FROM public.calls c
    WHERE c.user_id = p_sdr_user_id
      AND (COALESCE(c.started_at, c.created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
      AND public.call_is_visible(c.user_id, c.created_at)
  )
  SELECT
    day,
    COUNT(*)::int AS attempts,
    COUNT(*) FILTER (WHERE dur >= 30)::int AS effective,
    COUNT(*) FILTER (WHERE dur >= 120)::int AS qualified,
    COALESCE(SUM(dur), 0)::int AS total_seconds
  FROM base
  GROUP BY day
  ORDER BY day;
$function$;