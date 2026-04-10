-- Passo A: Corrigir installments pagos com hubla_transaction_id
UPDATE billing_installments bi
SET valor_original = ht.product_price,
    updated_at = now()
FROM hubla_transactions ht
WHERE bi.hubla_transaction_id = ht.id
  AND bi.numero_parcela > 1
  AND bi.valor_original != ht.product_price
  AND ht.product_price > 0;

-- Passo B: Corrigir installments pendentes/atrasados sem transação
WITH ref AS (
  SELECT DISTINCT ON (bi.subscription_id)
    bi.subscription_id, ht.product_price as correct_bruto
  FROM billing_installments bi
  JOIN hubla_transactions ht ON ht.id = bi.hubla_transaction_id
  WHERE bi.numero_parcela > 1 AND ht.product_price > 0
  ORDER BY bi.subscription_id, bi.numero_parcela
)
UPDATE billing_installments bi
SET valor_original = r.correct_bruto,
    updated_at = now()
FROM ref r
WHERE bi.subscription_id = r.subscription_id
  AND bi.numero_parcela > 1
  AND bi.hubla_transaction_id IS NULL
  AND bi.status IN ('pendente', 'atrasado')
  AND bi.valor_original != r.correct_bruto;

-- Passo C: Recalcular valor_total_contrato das subscriptions
UPDATE billing_subscriptions bs
SET valor_total_contrato = sub_totals.total,
    updated_at = now()
FROM (
  SELECT subscription_id, SUM(valor_original) as total
  FROM billing_installments
  GROUP BY subscription_id
) sub_totals
WHERE bs.id = sub_totals.subscription_id
  AND bs.valor_total_contrato != sub_totals.total;