ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS follow_up_action text,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS summary text;

CREATE INDEX IF NOT EXISTS idx_calls_user_started ON public.calls (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_follow_up ON public.calls (user_id, follow_up_action) WHERE follow_up_action IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='calls' AND policyname='calls_owner_update_followup'
  ) THEN
    CREATE POLICY "calls_owner_update_followup"
      ON public.calls
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;