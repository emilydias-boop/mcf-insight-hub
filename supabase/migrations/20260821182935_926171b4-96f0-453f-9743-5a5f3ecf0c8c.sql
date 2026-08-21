ALTER TABLE public.consorcio_pending_registrations
  ADD COLUMN IF NOT EXISTS parcela_inicial_paga_em date,
  ADD COLUMN IF NOT EXISTS parcela_inicial_paga_por uuid;

COMMENT ON COLUMN public.consorcio_pending_registrations.parcela_inicial_paga_em IS
  'Etapa 5 (Cotas Cadastradas): marcador OPERACIONAL INTERNO do pagamento da parcela inicial. Proibido gerar lancamento financeiro, cobranca, boleto, previsao de caixa, comissao ou webhook de saida a partir deste campo.';
COMMENT ON COLUMN public.consorcio_pending_registrations.parcela_inicial_paga_por IS
  'Quem marcou a parcela inicial como paga (controle interno).';