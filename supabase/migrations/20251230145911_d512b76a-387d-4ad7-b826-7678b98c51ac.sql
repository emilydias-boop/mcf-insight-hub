-- Add video_conference_link column to meeting_slots table
ALTER TABLE public.meeting_slots 
ADD COLUMN IF NOT EXISTS video_conference_link text;

-- Add comment for documentation
COMMENT ON COLUMN public.meeting_slots.video_conference_link IS 'Direct link to video conference room (Google Meet/Zoom) obtained from Calendly API';