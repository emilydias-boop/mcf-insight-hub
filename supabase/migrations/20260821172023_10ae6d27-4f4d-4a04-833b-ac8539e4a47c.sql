CREATE TABLE public.consorcio_proposal_edit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.consorcio_proposals(id) ON DELETE CASCADE,
  deal_id uuid,
  edited_by uuid,
  edited_by_nome text,
  alteracoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_consorcio_proposal_edit_log_proposal ON public.consorcio_proposal_edit_log(proposal_id, created_at DESC);

GRANT SELECT, INSERT ON public.consorcio_proposal_edit_log TO authenticated;
GRANT ALL ON public.consorcio_proposal_edit_log TO service_role;

ALTER TABLE public.consorcio_proposal_edit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view proposal edit log"
ON public.consorcio_proposal_edit_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert proposal edit log"
ON public.consorcio_proposal_edit_log FOR INSERT TO authenticated
WITH CHECK ((auth.uid() = edited_by) OR (edited_by IS NULL));