-- Adicionar campo calendly_default_link na tabela closers
ALTER TABLE public.closers 
ADD COLUMN IF NOT EXISTS calendly_default_link text;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.closers.calendly_default_link IS 'Link padrão do Calendly para enviar aos leads (ex: https://calendly.com/julio-mcf/reuniao-r01)';

-- Adicionar campos na tabela meeting_slot_attendees
ALTER TABLE public.meeting_slot_attendees 
ADD COLUMN IF NOT EXISTS attendee_name text,
ADD COLUMN IF NOT EXISTS attendee_phone text,
ADD COLUMN IF NOT EXISTS is_partner boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notified_at timestamp with time zone;

-- Adicionar comentários explicativos
COMMENT ON COLUMN public.meeting_slot_attendees.attendee_name IS 'Nome do participante (útil para sócios sem cadastro)';
COMMENT ON COLUMN public.meeting_slot_attendees.attendee_phone IS 'Telefone do participante (útil para sócios sem cadastro)';
COMMENT ON COLUMN public.meeting_slot_attendees.is_partner IS 'Indica se é sócio do lead principal';
COMMENT ON COLUMN public.meeting_slot_attendees.notified_at IS 'Data/hora que o link foi enviado para este participante';