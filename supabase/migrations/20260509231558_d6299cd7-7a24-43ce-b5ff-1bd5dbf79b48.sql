CREATE TYPE public.automation_anchor AS ENUM (
  'enqueue_time',
  'meeting_start',
  'meeting_end',
  'contract_paid_at'
);

CREATE TYPE public.automation_step_kind AS ENUM (
  'confirmation',
  'reminder',
  'followup',
  'custom'
);

ALTER TABLE public.automation_steps
  ADD COLUMN anchor                public.automation_anchor    NOT NULL DEFAULT 'enqueue_time',
  ADD COLUMN offset_minutes        integer                     NOT NULL DEFAULT 0,
  ADD COLUMN min_lead_time_minutes integer                     NOT NULL DEFAULT 0,
  ADD COLUMN respect_send_window   boolean                     NOT NULL DEFAULT true,
  ADD COLUMN step_kind             public.automation_step_kind NOT NULL DEFAULT 'custom';

CREATE TABLE public.automation_routing_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id      uuid NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  origin_id    uuid REFERENCES public.crm_origins(id),
  product_code text,
  bu           text,
  priority     integer NOT NULL DEFAULT 100,
  is_active    boolean NOT NULL DEFAULT true,
  conditions   jsonb   NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_routing_rules_flow   ON public.automation_routing_rules(flow_id);
CREATE INDEX idx_routing_rules_lookup ON public.automation_routing_rules(origin_id, bu, product_code) WHERE is_active;

CREATE TRIGGER trg_routing_rules_updated
  BEFORE UPDATE ON public.automation_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.automation_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage routing rules"
  ON public.automation_routing_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read routing rules"
  ON public.automation_routing_rules FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.automation_settings (key, value) VALUES
  ('automation_timezone',          '"America/Sao_Paulo"'::jsonb),
  ('automation_send_window_start', '"09:00"'::jsonb),
  ('automation_send_window_end',   '"20:00"'::jsonb),
  ('leticia_whatsapp',             '""'::jsonb)
ON CONFLICT (key) DO NOTHING;