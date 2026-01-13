-- Create attendee_notes table for multiple notes per attendee
CREATE TABLE public.attendee_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attendee_id UUID NOT NULL REFERENCES public.meeting_slot_attendees(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('initial', 'reschedule', 'general')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_attendee_notes_attendee_id ON public.attendee_notes(attendee_id);

-- Enable RLS
ALTER TABLE public.attendee_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all attendee notes"
  ON public.attendee_notes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert notes"
  ON public.attendee_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own notes"
  ON public.attendee_notes FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own notes"
  ON public.attendee_notes FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- Migrate existing notes from meeting_slot_attendees to attendee_notes
INSERT INTO public.attendee_notes (attendee_id, note, note_type, created_by, created_at)
SELECT 
  id as attendee_id,
  CASE 
    WHEN notes LIKE '%--- Reagendado em%' THEN SPLIT_PART(notes, '--- Reagendado em', 1)
    ELSE notes
  END as note,
  'initial' as note_type,
  booked_by as created_by,
  created_at
FROM public.meeting_slot_attendees
WHERE notes IS NOT NULL AND TRIM(notes) != '';