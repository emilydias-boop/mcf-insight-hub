
-- Soft delete de Cartas Negociadas (consorcio_proposals) com log de exclusão
ALTER TABLE public.consorcio_proposals
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS deletion_had_pending_registration boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_consorcio_proposals_deleted_at
  ON public.consorcio_proposals(deleted_at)
  WHERE deleted_at IS NOT NULL;
