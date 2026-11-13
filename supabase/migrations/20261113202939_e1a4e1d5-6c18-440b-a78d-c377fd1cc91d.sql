ALTER TABLE public.app_telemetry
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS tab_visible boolean,
  ADD COLUMN IF NOT EXISTS screen_name text;
CREATE INDEX IF NOT EXISTS idx_app_telemetry_type_created ON public.app_telemetry (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_telemetry_user_created ON public.app_telemetry (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.telemetria_aceite (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  aceito_em timestamptz NOT NULL DEFAULT now(),
  versao text NOT NULL DEFAULT 'v1'
);
GRANT SELECT, INSERT ON public.telemetria_aceite TO authenticated;
GRANT ALL ON public.telemetria_aceite TO service_role;
ALTER TABLE public.telemetria_aceite ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aceite_select_own" ON public.telemetria_aceite FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "aceite_insert_own" ON public.telemetria_aceite FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.telemetria_presenca()
RETURNS TABLE(user_id uuid, nome text, email text, route text, screen_name text,
              last_heartbeat timestamptz, last_interaction_at timestamptz, tab_visible boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (t.user_id) t.user_id, p.full_name, p.email, t.route, t.screen_name,
         t.created_at, t.last_interaction_at, t.tab_visible
  FROM public.app_telemetry t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  WHERE t.event_type IN ('heartbeat','session_start','session_end')
    AND t.created_at > now() - interval '2 hours'
  ORDER BY t.user_id, t.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.telemetria_presenca() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.telemetria_presenca() TO authenticated;

CREATE OR REPLACE FUNCTION public.telemetria_atividade_dia(p_dia date, p_ocioso_min int DEFAULT 5)
RETURNS TABLE(user_id uuid, nome text, email text, ativo_seg int, ocioso_seg int,
              segundo_plano_seg int, telas jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH ev AS (
    SELECT t.user_id, t.event_type, t.created_at, coalesce(t.screen_name, t.route, '(desconhecida)') AS tela,
      CASE WHEN t.tab_visible IS FALSE THEN 'bg'
           WHEN t.last_interaction_at IS NULL
             OR t.created_at - t.last_interaction_at > make_interval(mins => greatest(p_ocioso_min,1)) THEN 'ocioso'
           ELSE 'ativo' END AS estado,
      LEAD(t.created_at) OVER (PARTITION BY t.session_id ORDER BY t.created_at) AS proximo
    FROM public.app_telemetry t
    WHERE t.event_type IN ('heartbeat','session_end')
      AND t.session_id IS NOT NULL
      AND (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date = p_dia
  ), hb AS (
    SELECT e.user_id, e.tela, e.estado,
      CASE WHEN e.proximo IS NULL THEN 0
           ELSE least(extract(epoch FROM e.proximo - e.created_at), 60) END AS seg
    FROM ev e WHERE e.event_type = 'heartbeat'
  ), por_tela AS (
    SELECT h.user_id, h.tela, sum(h.seg) AS n FROM hb h WHERE h.estado = 'ativo' GROUP BY 1,2
  )
  SELECT h.user_id, p.full_name, p.email,
    round(coalesce(sum(h.seg) FILTER (WHERE h.estado='ativo'),0))::int,
    round(coalesce(sum(h.seg) FILTER (WHERE h.estado='ocioso'),0))::int,
    round(coalesce(sum(h.seg) FILTER (WHERE h.estado='bg'),0))::int,
    coalesce((SELECT jsonb_agg(jsonb_build_object('tela', x.tela, 'seg', round(x.n)::int) ORDER BY x.n DESC)
              FROM (SELECT * FROM por_tela pt WHERE pt.user_id = h.user_id ORDER BY pt.n DESC LIMIT 5) x), '[]'::jsonb)
  FROM hb h LEFT JOIN public.profiles p ON p.id = h.user_id
  GROUP BY h.user_id, p.full_name, p.email
  ORDER BY 4 DESC;
END $$;
REVOKE ALL ON FUNCTION public.telemetria_atividade_dia(date,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.telemetria_atividade_dia(date,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.telemetria_limpar_presenca()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  DELETE FROM public.app_telemetry
  WHERE event_type IN ('heartbeat','session_start','session_end')
    AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.telemetria_limpar_presenca() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('telemetria-limpar-presenca', '30 6 * * *', $$SELECT public.telemetria_limpar_presenca();$$);