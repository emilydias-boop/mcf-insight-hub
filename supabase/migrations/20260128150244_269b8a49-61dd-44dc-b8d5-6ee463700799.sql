-- Adicionar coluna contract_paid_at na tabela meeting_slot_attendees
ALTER TABLE meeting_slot_attendees 
ADD COLUMN IF NOT EXISTS contract_paid_at TIMESTAMPTZ;