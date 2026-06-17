
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS transcript_sid text,
  ADD COLUMN IF NOT EXISTS transcript_status text,
  ADD COLUMN IF NOT EXISTS ai_summary jsonb,
  ADD COLUMN IF NOT EXISTS ai_processed_at timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS calls_transcript_sid_uniq ON public.calls(transcript_sid) WHERE transcript_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS calls_transcript_status_idx ON public.calls(transcript_status) WHERE transcript_status IS NOT NULL;
