-- Add lead_type and max_slots_per_hour to closer_availability
ALTER TABLE closer_availability 
ADD COLUMN IF NOT EXISTS lead_type TEXT DEFAULT 'A' CHECK (lead_type IN ('A', 'B'));

ALTER TABLE closer_availability 
ADD COLUMN IF NOT EXISTS max_slots_per_hour INTEGER DEFAULT 3;

-- Add lead_type to meeting_slots
ALTER TABLE meeting_slots 
ADD COLUMN IF NOT EXISTS lead_type TEXT CHECK (lead_type IN ('A', 'B'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_closer_availability_lead_type ON closer_availability(closer_id, lead_type, day_of_week);
CREATE INDEX IF NOT EXISTS idx_meeting_slots_lead_type ON meeting_slots(lead_type, scheduled_at);