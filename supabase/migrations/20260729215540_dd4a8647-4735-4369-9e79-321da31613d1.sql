ALTER TABLE public.consorcio_proposals DROP CONSTRAINT IF EXISTS consorcio_proposals_consortium_card_id_fkey;
ALTER TABLE public.consorcio_proposals ADD CONSTRAINT consorcio_proposals_consortium_card_id_fkey FOREIGN KEY (consortium_card_id) REFERENCES public.consortium_cards(id) ON DELETE SET NULL;

ALTER TABLE public.credit_partners DROP CONSTRAINT IF EXISTS credit_partners_consorcio_card_id_fkey;
ALTER TABLE public.credit_partners ADD CONSTRAINT credit_partners_consorcio_card_id_fkey FOREIGN KEY (consorcio_card_id) REFERENCES public.consortium_cards(id) ON DELETE SET NULL;

ALTER TABLE public.consorcio_proposals
  ADD COLUMN IF NOT EXISTS carta_excluida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS carta_excluida_em timestamptz,
  ADD COLUMN IF NOT EXISTS carta_excluida_por uuid,
  ADD COLUMN IF NOT EXISTS carta_excluida_por_nome text,
  ADD COLUMN IF NOT EXISTS carta_excluida_motivo text;