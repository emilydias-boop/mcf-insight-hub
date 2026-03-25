
-- Table to track video sending status for paid contracts
CREATE TABLE public.contract_video_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id uuid NOT NULL REFERENCES public.meeting_slot_attendees(id) ON DELETE CASCADE,
  video_sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  sent_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attendee_id)
);

-- Enable RLS
ALTER TABLE public.contract_video_control ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read, insert, update
CREATE POLICY "Authenticated users can read video control"
  ON public.contract_video_control FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert video control"
  ON public.contract_video_control FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update video control"
  ON public.contract_video_control FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_contract_video_control_updated_at
  BEFORE UPDATE ON public.contract_video_control
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
