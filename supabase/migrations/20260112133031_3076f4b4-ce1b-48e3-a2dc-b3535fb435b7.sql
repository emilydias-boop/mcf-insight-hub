-- Adicionar coluna already_builds na tabela meeting_slot_attendees
ALTER TABLE public.meeting_slot_attendees 
ADD COLUMN already_builds BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN public.meeting_slot_attendees.already_builds IS 'Indica se o lead já constrói (true) ou não constrói (false). NULL = não informado.';