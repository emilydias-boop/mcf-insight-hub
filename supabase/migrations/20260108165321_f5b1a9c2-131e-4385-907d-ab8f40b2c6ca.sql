-- Adicionar coluna para vincular sócio ao participante principal
ALTER TABLE meeting_slot_attendees
ADD COLUMN parent_attendee_id UUID REFERENCES meeting_slot_attendees(id) ON DELETE SET NULL;

-- Índice para buscar sócios de um participante
CREATE INDEX idx_attendees_parent ON meeting_slot_attendees(parent_attendee_id);

COMMENT ON COLUMN meeting_slot_attendees.parent_attendee_id IS 
  'ID do participante principal ao qual este sócio está vinculado';