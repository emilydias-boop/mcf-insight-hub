-- Fase 1: Adicionar coluna customer_document em hubla_transactions e fazer backfill

-- 1. Adicionar coluna
ALTER TABLE public.hubla_transactions
ADD COLUMN IF NOT EXISTS customer_document text;

-- 2. Função helper para normalizar CPF (manter apenas dígitos)
CREATE OR REPLACE FUNCTION public.normalize_document(doc text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(doc, ''), '[^0-9]', '', 'g'), '');
$$;

-- 3. Backfill: extrair CPF do raw_data nos dois formatos conhecidos
--    Formato A (webhook API): event.user.document, event.invoice.payer.document
--    Formato B (export CSV PT-BR): "Documento do cliente"
UPDATE public.hubla_transactions
SET customer_document = public.normalize_document(
  COALESCE(
    raw_data->'event'->'user'->>'document',
    raw_data->'event'->'invoice'->'payer'->>'document',
    raw_data->>'Documento do cliente',
    raw_data->'user'->>'document',
    raw_data->'payer'->>'document'
  )
)
WHERE customer_document IS NULL
  AND raw_data IS NOT NULL;

-- 4. Índice para buscas rápidas por CPF (filtro parcial p/ economizar espaço)
CREATE INDEX IF NOT EXISTS idx_hubla_transactions_customer_document
ON public.hubla_transactions (customer_document)
WHERE customer_document IS NOT NULL;