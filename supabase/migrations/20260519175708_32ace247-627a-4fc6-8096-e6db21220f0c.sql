ALTER TABLE public.meeting_slot_attendees
  ALTER COLUMN booked_by SET DEFAULT auth.uid();