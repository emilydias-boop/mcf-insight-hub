
-- Step 1: Fix valor_original for parcelas 2+ that have a linked hubla transaction
UPDATE billing_installments bi
SET 
  valor_original = COALESCE(ht.net_value, 0),
  updated_at = now()
FROM hubla_transactions ht
WHERE bi.hubla_transaction_id = ht.id
  AND bi.numero_parcela > 1;

-- Step 2: Fix valor_original for parcelas 2+ WITHOUT a linked transaction
-- Use the net_value from the parcela 1's hubla transaction of the same subscription
WITH ref AS (
  SELECT bi1.subscription_id, COALESCE(ht1.net_value, 0) AS net_ref
  FROM billing_installments bi1
  JOIN hubla_transactions ht1 ON bi1.hubla_transaction_id = ht1.id
  WHERE bi1.numero_parcela = 1
)
UPDATE billing_installments bi
SET 
  valor_original = ref.net_ref,
  updated_at = now()
FROM ref
WHERE bi.subscription_id = ref.subscription_id
  AND bi.numero_parcela > 1
  AND bi.hubla_transaction_id IS NULL;

-- Step 3: Recalculate valor_total_contrato for all subscriptions with hubla installments
-- valor_total = parcela1.valor_original + (total_parcelas - 1) * parcela2.valor_original
WITH sub_values AS (
  SELECT 
    bs.id,
    bs.total_parcelas,
    MAX(CASE WHEN i.numero_parcela = 1 THEN i.valor_original ELSE 0 END) AS val_p1,
    MAX(CASE WHEN i.numero_parcela = 2 THEN i.valor_original ELSE 0 END) AS val_p2
  FROM billing_subscriptions bs
  JOIN billing_installments i ON i.subscription_id = bs.id
  WHERE EXISTS (
    SELECT 1 FROM billing_installments bi2 
    WHERE bi2.subscription_id = bs.id 
    AND bi2.hubla_transaction_id IS NOT NULL
  )
  GROUP BY bs.id, bs.total_parcelas
)
UPDATE billing_subscriptions bs
SET 
  valor_total_contrato = sv.val_p1 + GREATEST(sv.total_parcelas - 1, 0) * sv.val_p2,
  updated_at = now()
FROM sub_values sv
WHERE bs.id = sv.id;

-- Step 4: Recalculate status_quitacao and status
WITH sub_stats AS (
  SELECT 
    bs.id,
    bs.total_parcelas,
    bs.valor_total_contrato,
    COUNT(*) FILTER (WHERE i.status = 'pago') as parcelas_pagas,
    COUNT(*) FILTER (WHERE i.status = 'atrasado') as parcelas_atrasadas,
    COALESCE(SUM(CASE WHEN i.status = 'pago' THEN i.valor_pago ELSE 0 END), 0) as total_pago
  FROM billing_subscriptions bs
  JOIN billing_installments i ON i.subscription_id = bs.id
  WHERE EXISTS (
    SELECT 1 FROM billing_installments bi2 
    WHERE bi2.subscription_id = bs.id 
    AND bi2.hubla_transaction_id IS NOT NULL
  )
  GROUP BY bs.id, bs.total_parcelas, bs.valor_total_contrato
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
