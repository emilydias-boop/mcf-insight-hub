
-- 1) automation_flows: novos campos para gatilho por evento do sistema e canal
ALTER TABLE public.automation_flows
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'stage_change',
  ADD COLUMN IF NOT EXISTS trigger_event text,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS body_template text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_flows_trigger_type_check'
  ) THEN
    ALTER TABLE public.automation_flows
      ADD CONSTRAINT automation_flows_trigger_type_check
      CHECK (trigger_type IN ('stage_change','system_event'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_flows_channel_check'
  ) THEN
    ALTER TABLE public.automation_flows
      ADD CONSTRAINT automation_flows_channel_check
      CHECK (channel IN ('email','whatsapp','both'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_flows_trigger_event
  ON public.automation_flows(trigger_event)
  WHERE trigger_type = 'system_event';

-- 2) consorcio_pending_registrations: marcadores de envio (idempotência)
ALTER TABLE public.consorcio_pending_registrations
  ADD COLUMN IF NOT EXISTS boas_vindas_email_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS boas_vindas_whatsapp_enviado_em timestamptz;

-- 3) Seed do fluxo padrão "Boas-vindas Carta Cadastrada"
INSERT INTO public.automation_flows (
  name, description, is_active, trigger_type, trigger_event, channel,
  subject, body_template, trigger_on, respect_business_hours, exclude_weekends
)
SELECT
  'Boas-vindas Carta Cadastrada',
  'Envio automático após a carta de consórcio ser cadastrada em Controle Consórcio. Suporta e-mail (Brevo) e WhatsApp (Twilio).',
  true,
  'system_event',
  'consorcio_carta_cadastrada',
  'email',
  'Parabéns pela sua nova Carta de Consórcio! Conheça seu time de acompanhamento',
  'Olá, {{nome}}!

É com grande satisfação que confirmamos oficialmente a aquisição da sua Carta de Consórcio, negociada na reunião com nossa equipe de Alavancagem Patrimonial.

Parabéns pela decisão! A partir de agora, você não estará sozinho nessa jornada.

Emily e Antony serão os responsáveis por cuidar da sua carta de consórcio de ponta a ponta. Em breve entrarão em contato com você pelo WhatsApp.

Contatos:
- Emily — WhatsApp: +55 11 94065-2061 — emily.dias@minhacasafinanciada.com
- Antony — WhatsApp: +55 11 94028-4344 — antony.nicolas@minhacasafinanciada.com

Qualquer dúvida, pode contar com toda a nossa equipe.',
  'enter',
  false,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_flows
  WHERE trigger_type = 'system_event' AND trigger_event = 'consorcio_carta_cadastrada'
);
