
-- Fix 1: Correct valor_pago = 0 on backfilled installments
UPDATE billing_installments bi
SET 
  valor_pago = COALESCE(NULLIF(ht.net_value, 0), ht.product_price, bi.valor_original),
  updated_at = now()
FROM hubla_transactions ht
WHERE bi.hubla_transaction_id = ht.id
  AND bi.status = 'pago'
  AND (bi.valor_pago = 0 OR bi.valor_pago IS NULL);

-- Fix 2: Recalculate status_quitacao for affected subscriptions
WITH affected_subs AS (
  SELECT DISTINCT bi.subscription_id
  FROM billing_installments bi
  JOIN hubla_transactions ht ON bi.hubla_transaction_id = ht.id
  WHERE bi.status = 'pago'
),
sub_stats AS (
  SELECT 
    bs.id,
    bs.total_parcelas,
    COUNT(*) FILTER (WHERE i.status = 'pago') as parcelas_pagas,
    COUNT(*) FILTER (WHERE i.status = 'atrasado') as parcelas_atrasadas
  FROM billing_subscriptions bs
  JOIN affected_subs a ON a.subscription_id = bs.id
  JOIN billing_installments i ON i.subscription_id = bs.id
  GROUP BY bs.id, bs.total_parcelas
)
UPDATE billing_subscriptions bs
SET 
  status_quitacao = (CASE 
    WHEN ss.parcelas_pagas >= ss.total_parcelas THEN 'quitado'
    WHEN ss.parcelas_pagas > 0 THEN 'parcialmente_pago'
    ELSE 'em_aberto'
  END)::billing_quitacao_status,
  status = (CASE 
    WHEN ss.parcelas_pagas >= ss.total_parcelas THEN 'quitada'
    WHEN ss.parcelas_atrasadas > 0 THEN 'atrasada'
    ELSE 'em_dia'
  END)::billing_subscription_status,
  updated_at = now()
FROM sub_stats ss
WHERE bs.id = ss.id;
