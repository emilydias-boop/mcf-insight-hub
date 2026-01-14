-- Add meeting_type column to closers table to differentiate R1 and R2 closers
ALTER TABLE public.closers ADD COLUMN IF NOT EXISTS meeting_type text DEFAULT 'r1';

-- Add meeting_type column to meeting_slots table to differentiate R1 and R2 meetings
ALTER TABLE public.meeting_slots ADD COLUMN IF NOT EXISTS meeting_type text DEFAULT 'r1';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_closers_meeting_type ON public.closers(meeting_type);
CREATE INDEX IF NOT EXISTS idx_meeting_slots_meeting_type ON public.meeting_slots(meeting_type);

-- Update existing closers to be R1 type (they were already R1)
UPDATE public.closers SET meeting_type = 'r1' WHERE meeting_type IS NULL;