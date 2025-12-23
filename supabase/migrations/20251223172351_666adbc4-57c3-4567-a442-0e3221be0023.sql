-- Add Calendly integration columns to meeting_slots
ALTER TABLE meeting_slots 
ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT,
ADD COLUMN IF NOT EXISTS calendly_invitee_uri TEXT;

-- Create index for faster lookups by Calendly URI
CREATE INDEX IF NOT EXISTS idx_meeting_slots_calendly_event_uri 
ON meeting_slots(calendly_event_uri) 
WHERE calendly_event_uri IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_slots_calendly_invitee_uri 
ON meeting_slots(calendly_invitee_uri) 
WHERE calendly_invitee_uri IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN meeting_slots.calendly_event_uri IS 'URI do evento no Calendly para sincronização';
COMMENT ON COLUMN meeting_slots.calendly_invitee_uri IS 'URI do invitee no Calendly para sincronização';