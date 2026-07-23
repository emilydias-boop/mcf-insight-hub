ALTER TABLE public.automation_flows
  ADD COLUMN IF NOT EXISTS template_id uuid NULL REFERENCES public.automation_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automation_flows_template_id
  ON public.automation_flows(template_id);