-- Adicionar 'refunded' ao constraint de status de meeting_slots
ALTER TABLE meeting_slots DROP CONSTRAINT IF EXISTS meeting_slots_status_check;
ALTER TABLE meeting_slots ADD CONSTRAINT meeting_slots_status_check 
CHECK (status = ANY (ARRAY[
  'scheduled'::text, 'completed'::text, 'no_show'::text, 'cancelled'::text, 'canceled'::text, 
  'rescheduled'::text, 'contract_paid'::text, 'refunded'::text
]));