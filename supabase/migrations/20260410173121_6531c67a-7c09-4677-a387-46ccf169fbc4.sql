-- Corrigir installments com valor_original inflado usando P2+ paga como referência
WITH correct_values AS (
  SELECT DISTINCT ON (i.subscription_id)
    i.subscription_id,
    i.valor_original as correct_value
  FROM billing_installments i
  WHERE i.numero_parcela > 1
    AND i.status = 'pago'
    AND i.valor_pago > 0
  ORDER BY i.subscription_id, i.numero_parcela
)
UPDATE billing_installments bi
SET valor_original = cv.correct_value,
    updated_at = now()
FROM correct_values cv
WHERE bi.subscription_id = cv.subscription_id
  AND bi.numero_parcela > 1
  AND bi.status IN ('pendente', 'atrasado')
  AND bi.valor_original > cv.correct_value * 3;

-- Recalcular valor_total_contrato nas subscriptions afetadas
UPDATE billing_subscriptions bs
SET valor_total_contrato = sub_totals.total,
    updated_at = now()
FROM (
  SELECT subscription_id, SUM(valor_original) as total
  FROM billing_installments
  GROUP BY subscription_id
) sub_totals
WHERE bs.id = sub_totals.subscription_id
  AND ABS(bs.valor_total_contrato - sub_totals.total) > 100;