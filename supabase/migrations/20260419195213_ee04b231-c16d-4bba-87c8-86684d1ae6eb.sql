ALTER TABLE public.consorcio_proposals
ADD COLUMN IF NOT EXISTS aguardando_retorno boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS aguardando_retorno_until timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_consorcio_proposals_aguardando_retorno 
  ON public.consorcio_proposals(aguardando_retorno) 
  WHERE aguardando_retorno = true;