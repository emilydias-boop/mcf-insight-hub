-- Add closer_notes column to meeting_slots table
ALTER TABLE meeting_slots ADD COLUMN closer_notes TEXT;

-- Add comment explaining the fields
COMMENT ON COLUMN meeting_slots.notes IS 'Notes written by SDR when scheduling the meeting';
COMMENT ON COLUMN meeting_slots.closer_notes IS 'Notes written by Closer during/after the meeting';