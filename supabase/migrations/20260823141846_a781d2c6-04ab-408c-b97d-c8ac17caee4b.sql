ALTER TABLE public.consorcio_proposal_cartas ADD CONSTRAINT consorcio_proposal_cartas_valor_credito_positivo CHECK (valor_credito IS NULL OR valor_credito > 0) NOT VALID;
ALTER TABLE public.consorcio_proposal_cartas VALIDATE CONSTRAINT consorcio_proposal_cartas_valor_credito_positivo;

ALTER TABLE public.consortium_cards ADD CONSTRAINT consortium_cards_valor_credito_positivo CHECK (valor_credito IS NULL OR valor_credito > 0) NOT VALID;
ALTER TABLE public.consortium_cards VALIDATE CONSTRAINT consortium_cards_valor_credito_positivo;

ALTER TABLE public.consorcio_proposals ADD CONSTRAINT consorcio_proposals_valor_credito_positivo CHECK (valor_credito IS NULL OR valor_credito > 0) NOT VALID;
ALTER TABLE public.consorcio_proposals VALIDATE CONSTRAINT consorcio_proposals_valor_credito_positivo;

ALTER TABLE public.consorcio_pending_registrations ADD CONSTRAINT consorcio_pending_registrations_valor_credito_positivo CHECK (valor_credito IS NULL OR valor_credito > 0) NOT VALID;
ALTER TABLE public.consorcio_pending_registrations VALIDATE CONSTRAINT consorcio_pending_registrations_valor_credito_positivo;

ALTER TABLE public.consorcio_creditos ADD CONSTRAINT consorcio_creditos_valor_credito_positivo CHECK (valor_credito IS NULL OR valor_credito > 0) NOT VALID;
ALTER TABLE public.consorcio_creditos VALIDATE CONSTRAINT consorcio_creditos_valor_credito_positivo;