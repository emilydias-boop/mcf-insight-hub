ALTER TABLE public.meeting_slot_attendees 
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;