-- 1. Remove old constraint
ALTER TABLE meeting_slots DROP CONSTRAINT IF EXISTS meeting_slots_status_check;

-- 2. Create new constraint including contract_paid and canceled
ALTER TABLE meeting_slots ADD CONSTRAINT meeting_slots_status_check 
CHECK (status = ANY (ARRAY[
  'scheduled',
  'completed', 
  'no_show',
  'cancelled',
  'canceled',
  'rescheduled',
  'contract_paid'
]));

-- 3. Fix inconsistent data - sync meeting_slots.status based on primary attendee
UPDATE meeting_slots ms
SET status = 'contract_paid'
FROM meeting_slot_attendees msa
WHERE msa.meeting_slot_id = ms.id
  AND msa.status = 'contract_paid'
  AND msa.is_partner = false
  AND msa.parent_attendee_id IS NULL
  AND ms.status != 'contract_paid';