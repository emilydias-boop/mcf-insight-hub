-- Corrigir valor_liquido da P1 quando inflado
WITH ref AS (
  SELECT DISTINCT ON (subscription_id)
    subscription_id, valor_liquido as ref_val
  FROM billing_installments
  WHERE numero_parcela > 1 AND status = 'pago' AND valor_liquido > 0
  ORDER BY subscription_id, numero_parcela
)
UPDATE billing_installments bi
SET valor_liquido = r.ref_val,
    updated_at = now()
FROM ref r
WHERE bi.subscription_id = r.subscription_id
  AND bi.numero_parcela = 1
  AND bi.valor_liquido > r.ref_val * 3;