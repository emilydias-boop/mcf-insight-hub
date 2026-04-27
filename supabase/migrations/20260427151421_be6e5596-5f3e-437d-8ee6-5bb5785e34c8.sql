-- Add tracking columns to hubla_transactions for contract linking visibility
ALTER TABLE public.hubla_transactions
  ADD COLUMN IF NOT EXISTS linked_by_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS linked_method text NULL CHECK (linked_method IN ('auto', 'manual'));

-- Index for fast lookup by linked deal/meeting
CREATE INDEX IF NOT EXISTS idx_hubla_transactions_linked_at
  ON public.hubla_transactions (linked_at)
  WHERE linked_at IS NOT NULL;