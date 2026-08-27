ALTER TABLE public.consorcio_pending_registrations ADD COLUMN parcelas_mcf_numeros integer[];
COMMENT ON COLUMN public.consorcio_pending_registrations.parcelas_mcf_numeros IS 'Números exatos das parcelas sob compromisso da MCF, na ordem escolhida no lançamento. Quando preenchida, é a fonte de verdade do cronograma; nula cai na derivação por tipo_contrato + quantidade (comportamento histórico).';

ALTER TABLE public.consortium_cards ADD COLUMN parcelas_mcf_numeros integer[];
COMMENT ON COLUMN public.consortium_cards.parcelas_mcf_numeros IS 'Números exatos das parcelas sob compromisso da MCF, na ordem escolhida no lançamento. Quando preenchida, é a fonte de verdade do cronograma; nula cai na derivação por tipo_contrato + quantidade (comportamento histórico).';