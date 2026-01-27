-- Corrigir constraint para permitir note_type = 'r2'
-- Remove a constraint existente
ALTER TABLE attendee_notes 
DROP CONSTRAINT IF EXISTS attendee_notes_note_type_check;

-- Adiciona nova constraint incluindo 'r2'
ALTER TABLE attendee_notes 
ADD CONSTRAINT attendee_notes_note_type_check 
CHECK (note_type = ANY (ARRAY['initial', 'reschedule', 'general', 'r2']));