CREATE TABLE public.app_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  event_type text NOT NULL,
  route text,
  message text,
  details jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.app_telemetry TO authenticated;
GRANT ALL ON public.app_telemetry TO service_role;
ALTER TABLE public.app_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telemetry_insert_own" ON public.app_telemetry FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) AND event_type IN ('error','page_view','page_load') AND length(coalesce(message,'')) <= 2000);
CREATE POLICY "telemetry_select_admin" ON public.app_telemetry FOR SELECT TO authenticated
  USING ((select public.has_role(auth.uid(), 'admin'::app_role)));
CREATE INDEX idx_app_telemetry_created ON public.app_telemetry (created_at DESC);
CREATE INDEX idx_app_telemetry_type_route ON public.app_telemetry (event_type, route);