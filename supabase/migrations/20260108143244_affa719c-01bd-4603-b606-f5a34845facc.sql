-- Add individual status and closer_notes to meeting_slot_attendees
ALTER TABLE meeting_slot_attendees
ADD COLUMN IF NOT EXISTS closer_notes TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';

COMMENT ON COLUMN meeting_slot_attendees.closer_notes IS 'Notas da closer sobre este participante específico';
COMMENT ON COLUMN meeting_slot_attendees.status IS 'Status individual do participante (scheduled, no_show, completed, contract_paid)';