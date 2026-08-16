ALTER TABLE public.meeting_slot_attendees
  ADD COLUMN IF NOT EXISTS outcome_reason text,
  ADD COLUMN IF NOT EXISTS outcome_reason_note text,
  ADD COLUMN IF NOT EXISTS outcome_set_by uuid,
  ADD COLUMN IF NOT EXISTS outcome_set_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_msa_outcome_reason
  ON public.meeting_slot_attendees (outcome_reason) WHERE outcome_reason IS NOT NULL;