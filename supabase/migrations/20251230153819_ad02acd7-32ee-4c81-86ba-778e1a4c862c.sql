-- Add Google Calendar fields to closers table
ALTER TABLE public.closers
ADD COLUMN IF NOT EXISTS google_calendar_id text,
ADD COLUMN IF NOT EXISTS google_calendar_enabled boolean DEFAULT false;

-- Add Google event ID to meeting_slots table
ALTER TABLE public.meeting_slots
ADD COLUMN IF NOT EXISTS google_event_id text;

-- Add comment for documentation
COMMENT ON COLUMN public.closers.google_calendar_id IS 'Google Calendar ID (email or "primary")';
COMMENT ON COLUMN public.closers.google_calendar_enabled IS 'Use Google Calendar instead of Calendly';
COMMENT ON COLUMN public.meeting_slots.google_event_id IS 'Google Calendar Event ID for updates/cancellations';