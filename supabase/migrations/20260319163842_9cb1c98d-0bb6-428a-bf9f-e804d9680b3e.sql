
INSERT INTO billing_history (subscription_id, tipo, valor, responsavel, descricao, created_at, metadata)
SELECT 
  bi.subscription_id,
  'parcela_paga'::billing_history_type,
  bi.valor_pago,
  'Sistema (Hubla Sync)',
  'Parcela ' || bi.numero_parcela || '/' || bs.total_parcelas || ' paga via Hubla (backfill)',
  COALESCE(bi.data_pagamento::timestamptz, bi.updated_at),
  jsonb_build_object(
    'hubla_transaction_id', bi.hubla_transaction_id,
    'numero_parcela', bi.numero_parcela,
    'backfill', true
  )
FROM billing_installments bi
JOIN billing_subscriptions bs ON bs.id = bi.subscription_id
WHERE bi.status = 'pago'
  AND bi.valor_pago IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM billing_history bh
    WHERE bh.subscription_id = bi.subscription_id
      AND bh.tipo = 'parcela_paga'
      AND (bh.metadata->>'numero_parcela')::int = bi.numero_parcela
  );
