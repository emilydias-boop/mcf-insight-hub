
ALTER TABLE public.automation_templates
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft','pending','approved','rejected','paused','disabled','unknown')),
  ADD COLUMN IF NOT EXISTS approval_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_rejected_reason text,
  ADD COLUMN IF NOT EXISTS buttons_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'utility'
    CHECK (category IN ('utility','marketing','authentication')),
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'pt_BR',
  ADD COLUMN IF NOT EXISTS variable_count integer DEFAULT 0;

COMMENT ON COLUMN public.automation_templates.approval_status IS
  'Status de aprovação Meta (via Twilio Content Approval API): draft = ainda não submetido, pending = aguardando Meta, approved = liberado para envio, rejected = recusado, paused/disabled = bloqueado pela Meta';
COMMENT ON COLUMN public.automation_templates.buttons_config IS
  'Array JSON de botões: [{ "type": "url"|"quick_reply", "text": "...", "url": "...", "url_param_key": "..." }]';

CREATE INDEX IF NOT EXISTS idx_automation_templates_approval_status
  ON public.automation_templates (approval_status);
CREATE INDEX IF NOT EXISTS idx_automation_templates_twilio_sid
  ON public.automation_templates (twilio_template_sid)
  WHERE twilio_template_sid IS NOT NULL;
