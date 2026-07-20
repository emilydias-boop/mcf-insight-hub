
CREATE TABLE IF NOT EXISTS public.consorcio_proposals_deleted_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_proposal_id uuid NOT NULL,
  deal_id uuid,
  contact_name text,
  contact_phone text,
  contact_email text,
  closer_name text,
  closer_email text,
  valor_credito numeric,
  prazo_meses integer,
  tipo_produto text,
  status text,
  proposal_created_at timestamptz,
  proposal_details text,
  had_pending_registration boolean NOT NULL DEFAULT false,
  pending_registration_snapshot jsonb,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by_name text,
  deleted_by_email text,
  deletion_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.consorcio_proposals_deleted_log TO authenticated;
GRANT ALL ON public.consorcio_proposals_deleted_log TO service_role;

ALTER TABLE public.consorcio_proposals_deleted_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view deleted proposals log"
  ON public.consorcio_proposals_deleted_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert deleted proposals log"
  ON public.consorcio_proposals_deleted_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = deleted_by OR deleted_by IS NULL);

CREATE INDEX IF NOT EXISTS idx_cpdl_created_at ON public.consorcio_proposals_deleted_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpdl_deal_id ON public.consorcio_proposals_deleted_log(deal_id);
