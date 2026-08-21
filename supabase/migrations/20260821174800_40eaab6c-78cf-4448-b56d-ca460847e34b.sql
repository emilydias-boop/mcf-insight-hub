ALTER TABLE public.consorcio_proposal_cartas
  ADD COLUMN IF NOT EXISTS parcelas_mcf integer[] NULL;

COMMENT ON COLUMN public.consorcio_proposal_cartas.parcelas_mcf IS
  'Intencao do closer no lancamento da venda: numeros das 12 primeiras parcelas que a MCF pretende pagar. NAO e verdade oficial (a confirmacao vive na etapa 5) e nao alimenta comissao, cronograma nem previsao de caixa.';