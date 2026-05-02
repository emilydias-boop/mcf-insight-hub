
-- 1. Adicionar colunas de reserva/contratação
ALTER TABLE public.consortium_cards
  ADD COLUMN IF NOT EXISTS data_reserva date,
  ADD COLUMN IF NOT EXISTS tipo_registro text NOT NULL DEFAULT 'contratacao';

-- 2. Permitir data_contratacao nula (para reservas)
ALTER TABLE public.consortium_cards
  ALTER COLUMN data_contratacao DROP NOT NULL;

-- 3. Constraint de tipo_registro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consortium_cards_tipo_registro_check'
  ) THEN
    ALTER TABLE public.consortium_cards
      ADD CONSTRAINT consortium_cards_tipo_registro_check
      CHECK (tipo_registro IN ('reserva','contratacao'));
  END IF;
END $$;

-- 4. Garantir consistência: contratacao precisa de data_contratacao; reserva precisa de data_reserva
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consortium_cards_datas_consistencia_check'
  ) THEN
    ALTER TABLE public.consortium_cards
      ADD CONSTRAINT consortium_cards_datas_consistencia_check
      CHECK (
        (tipo_registro = 'reserva'    AND data_reserva IS NOT NULL) OR
        (tipo_registro = 'contratacao' AND data_contratacao IS NOT NULL)
      );
  END IF;
END $$;

-- 5. Backfill: cartas existentes ficam como 'contratacao'
UPDATE public.consortium_cards
SET tipo_registro = 'contratacao'
WHERE tipo_registro IS NULL;

-- 6. Comentários
COMMENT ON COLUMN public.consortium_cards.data_reserva IS 'Data em que a cota foi reservada/acordada (antes do pagamento da 1a parcela)';
COMMENT ON COLUMN public.consortium_cards.tipo_registro IS 'reserva = cota acordada sem 1a parcela paga; contratacao = 1a parcela paga';

-- 7. Permitir status "previsto" nas parcelas (para cotas em reserva)
DO $$
DECLARE
  cons_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO cons_def
  FROM pg_constraint
  WHERE conname = 'consortium_installments_status_check';

  IF cons_def IS NOT NULL AND cons_def NOT LIKE '%previsto%' THEN
    ALTER TABLE public.consortium_installments
      DROP CONSTRAINT consortium_installments_status_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'consortium_installments_status_check'
  ) THEN
    ALTER TABLE public.consortium_installments
      ADD CONSTRAINT consortium_installments_status_check
      CHECK (status IN ('pendente','pago','atrasado','cancelado','isento','previsto'));
  END IF;
END $$;

-- 8. Índices úteis
CREATE INDEX IF NOT EXISTS idx_consortium_cards_tipo_registro ON public.consortium_cards(tipo_registro);
CREATE INDEX IF NOT EXISTS idx_consortium_cards_data_reserva ON public.consortium_cards(data_reserva);
