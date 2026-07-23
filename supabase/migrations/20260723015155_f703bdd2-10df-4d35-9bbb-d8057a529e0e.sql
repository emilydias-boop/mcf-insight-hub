
-- 1) Coluna de idempotência para envio do WhatsApp "Boas-vindas R2"
ALTER TABLE public.meeting_slot_attendees
  ADD COLUMN IF NOT EXISTS boas_vindas_r2_whatsapp_enviado_em timestamptz;

COMMENT ON COLUMN public.meeting_slot_attendees.boas_vindas_r2_whatsapp_enviado_em IS
  'Timestamp do envio do WhatsApp de boas-vindas/agendamento R2 após Contrato Pago. Usado para idempotência.';

-- 2) Trigger que invoca o automation-event-dispatcher quando contract_paid_at
--    transita de NULL para NOT NULL. Não bloqueia a operação (net.http_post é async).
CREATE OR REPLACE FUNCTION public.trg_notify_attendee_contract_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só dispara na transição NULL -> NOT NULL
  IF NEW.contract_paid_at IS NOT NULL
     AND (OLD.contract_paid_at IS NULL OR OLD.contract_paid_at IS DISTINCT FROM NEW.contract_paid_at AND OLD.contract_paid_at IS NULL)
  THEN
    -- Ignora sócios
    IF COALESCE(NEW.is_partner, false) = true THEN
      RETURN NEW;
    END IF;

    -- Só se ainda não foi enviado (idempotência forte no banco)
    IF NEW.boas_vindas_r2_whatsapp_enviado_em IS NULL THEN
      PERFORM net.http_post(
        url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/automation-event-dispatcher',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
        body := jsonb_build_object(
          'event', 'attendee_contract_paid',
          'attendee_id', NEW.id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_attendee_contract_paid ON public.meeting_slot_attendees;
CREATE TRIGGER trg_notify_attendee_contract_paid
AFTER UPDATE OF contract_paid_at ON public.meeting_slot_attendees
FOR EACH ROW
WHEN (NEW.contract_paid_at IS NOT NULL AND OLD.contract_paid_at IS NULL)
EXECUTE FUNCTION public.trg_notify_attendee_contract_paid();

-- 3) Seed do fluxo padrão (inativo, admin ativa pela UI depois de conectar Twilio)
INSERT INTO public.automation_flows (name, description, channel, subject, body_template, is_active, trigger_type, trigger_event)
SELECT
  'Boas-vindas R2 (Contrato Pago)',
  'Envia mensagem no WhatsApp para o lead assim que ele é marcado como Contrato Pago na Agenda R1, orientando os próximos passos e agendamento da R2.',
  'whatsapp',
  NULL,
  E'Olá, {{nome}}! 🎉\n\nParabéns pela decisão — seu contrato foi confirmado e você agora faz parte da Seleção MCF.\n\n*SEUS PRÓXIMOS PASSOS — O que fazer agora:*\n\n*1) Acesse o conteúdo na MCF Pay*\nLá estão os detalhes do contrato e a explicação completa do nosso modelo de negócio (Acesso no seu email).\n\n*2) Agende sua reunião de seleção*\nO passo que garante sua vaga. É a reunião com um sócio da MCF — sem ela, você não avança.\n👉 Agende sua R2 aqui: https://hi.switchy.io/x9NB\n\n*3) Entre no grupo dos selecionados*\nNo mesmo contato acima você recebe informações sobre a abertura das vagas e a reunião com a equipe.\n\nQualquer dúvida, é só chamar por aqui. Nos vemos na R2! 🚀',
  false,
  'system_event',
  'attendee_contract_paid'
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_flows
  WHERE trigger_type = 'system_event' AND trigger_event = 'attendee_contract_paid'
);
