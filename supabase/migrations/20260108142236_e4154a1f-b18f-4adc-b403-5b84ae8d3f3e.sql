-- Adicionar campos de notas e SDR por participante na tabela meeting_slot_attendees
ALTER TABLE meeting_slot_attendees
ADD COLUMN IF NOT EXISTS booked_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Comentários para documentação
COMMENT ON COLUMN meeting_slot_attendees.booked_by IS 'SDR que agendou este participante específico';
COMMENT ON COLUMN meeting_slot_attendees.notes IS 'Nota do SDR sobre este participante específico';