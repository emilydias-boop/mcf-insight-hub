ALTER TABLE public.consorcio_proposal_cartas
  ADD COLUMN IF NOT EXISTS parcela_1a_12a numeric,
  ADD COLUMN IF NOT EXISTS parcela_demais numeric,
  ADD COLUMN IF NOT EXISTS condicao_pagamento text,
  ADD COLUMN IF NOT EXISTS objetivo text;