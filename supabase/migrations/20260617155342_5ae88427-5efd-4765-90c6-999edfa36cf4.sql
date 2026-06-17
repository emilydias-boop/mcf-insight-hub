
ALTER TABLE public.attendee_notes DROP CONSTRAINT IF EXISTS attendee_notes_note_type_check;
ALTER TABLE public.attendee_notes ADD CONSTRAINT attendee_notes_note_type_check
  CHECK (note_type = ANY (ARRAY['initial'::text,'reschedule'::text,'general'::text,'r2'::text,'call_summary'::text]));
