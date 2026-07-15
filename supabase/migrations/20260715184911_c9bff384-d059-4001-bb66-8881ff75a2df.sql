ALTER TABLE public.consorcio_pending_registrations
  DROP CONSTRAINT consorcio_pending_registrations_proposal_id_fkey,
  ADD CONSTRAINT consorcio_pending_registrations_proposal_id_fkey
    FOREIGN KEY (proposal_id) REFERENCES public.consorcio_proposals(id) ON DELETE SET NULL;