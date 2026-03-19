
-- Step 1: Fix valor_pago for parcelas 2+ that incorrectly fell back to product_price
-- Set valor_pago = ht.net_value directly (no fallback to product_price)
UPDATE billing_installments bi
SET 
  valor_pago = ht.net_value,
  updated_at = now()
FROM hubla_transactions ht
WHERE bi.hubla_transaction_id = ht.id
  AND bi.numero_parcela > 1
  AND bi.status = 'pago';

-- Step 2: Recalculate valor_total_contrato using net_value from parcela 1's transaction
-- (not parcela 2 which may be 0)
WITH p1_ref AS (
  SELECT 
    bi.subscription_id,
    bi.valor_original AS val_p1,
    COALESCE(ht.net_value, 0) AS net_ref
  FROM billing_installments bi
  LEFT JOIN hubla_transactions ht ON bi.hubla_transaction_id = ht.id
  WHERE bi.numero_parcela = 1
)
UPDATE billing_subscriptions bs
SET 
  valor_total_contrato = p1.val_p1 + GREATEST(bs.total_parcelas - 1, 0) * p1.net_ref,
  updated_at = now()
FROM p1_ref p1
WHERE bs.id = p1.subscription_id;

-- Step 3: Also fix valor_original for parcelas 2+ without transaction
-- that used parcela 2's net (0) instead of parcela 1's net as reference
WITH p1_net AS (
  SELECT 
    bi.subscription_id,
    COALESCE(ht.net_value, 0) AS net_ref
  FROM billing_installments bi
  LEFT JOIN hubla_transactions ht ON bi.hubla_transaction_id = ht.id
  WHERE bi.numero_parcela = 1
)
UPDATE billing_installments bi
SET 
  valor_original = p1.net_ref,
  updated_at = now()
FROM p1_net p1
WHERE bi.subscription_id = p1.subscription_id
  AND bi.numero_parcela > 1
  AND bi.hubla_transaction_id IS NULL;

-- Step 4: Recalculate status_quitacao and status
WITH sub_stats AS (
  SELECT 
    bs.id,
    bs.total_parcelas,
    COUNT(*) FILTER (WHERE i.status = 'pago') as parcelas_pagas,
    COUNT(*) FILTER (WHERE i.status = 'atrasado') as parcelas_atrasadas
  FROM billing_subscriptions bs
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
