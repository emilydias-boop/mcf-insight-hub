-- Tabela de log/dedupe de lembretes
CREATE TABLE public.meeting_reminders_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_slot_id UUID NOT NULL REFERENCES public.meeting_slots(id) ON DELETE CASCADE,
  attendee_id UUID NOT NULL REFERENCES public.meeting_slot_attendees(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  offset_key TEXT NOT NULL,
  meeting_type TEXT NOT NULL,
  status TEXT NOT NULL,
  skip_reason TEXT,
  ac_contact_id TEXT,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meeting_reminders_log_unique_attendee_offset UNIQUE (attendee_id, offset_key)
);

CREATE INDEX idx_meeting_reminders_log_sent_at ON public.meeting_reminders_log(sent_at DESC);
CREATE INDEX idx_meeting_reminders_log_status ON public.meeting_reminders_log(status);
CREATE INDEX idx_meeting_reminders_log_attendee ON public.meeting_reminders_log(attendee_id);
CREATE INDEX idx_meeting_reminders_log_slot ON public.meeting_reminders_log(meeting_slot_id);

ALTER TABLE public.meeting_reminders_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and coordenadores can view reminder logs"
ON public.meeting_reminders_log FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'coordenador')
);

CREATE POLICY "Service role manages reminder logs"
ON public.meeting_reminders_log FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Tabela de configurações (1 linha)
CREATE TABLE public.meeting_reminder_settings (
  id INT PRIMARY KEY DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  enabled_offsets TEXT[] NOT NULL DEFAULT ARRAY['d-1','h-4','h-2','h-1','m-20','m-0'],
  apply_to_r1 BOOLEAN NOT NULL DEFAULT true,
  apply_to_r2 BOOLEAN NOT NULL DEFAULT true,
  fallback_meeting_link TEXT,
  ac_list_id INT,
  ac_setup_confirmed BOOLEAN NOT NULL DEFAULT false,
  ac_field_ids JSONB DEFAULT '{}'::jsonb,
  ac_setup_checklist JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT meeting_reminder_settings_singleton CHECK (id = 1)
);

INSERT INTO public.meeting_reminder_settings (id) VALUES (1);

ALTER TABLE public.meeting_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and coordenadores can view settings"
ON public.meeting_reminder_settings FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'coordenador')
);

CREATE POLICY "Admins can update settings"
ON public.meeting_reminder_settings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role reads/updates settings"
ON public.meeting_reminder_settings FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Trigger para updated_at
CREATE TRIGGER update_meeting_reminder_settings_updated_at
BEFORE UPDATE ON public.meeting_reminder_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Cron job a cada 5 minutos
SELECT cron.schedule(
  'meeting-reminders-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/meeting-reminders-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE'
    ),
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);