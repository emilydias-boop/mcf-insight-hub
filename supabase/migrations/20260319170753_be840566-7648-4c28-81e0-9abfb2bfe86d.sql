
-- Backfill: Match hubla_transactions with total_installments=1 to existing billing_installments

CREATE TEMP TABLE backfill_matches AS
WITH 
subs_with_overdue AS (
  SELECT DISTINCT bs.id as sub_id, bs.customer_email, bs.product_name
  FROM billing_subscriptions bs
  INNER JOIN billing_installments bi ON bi.subscription_id = bs.id
  WHERE bi.status = 'atrasado'
    AND bi.hubla_transaction_id IS NULL
    AND bs.customer_email IS NOT NULL
),
unlinked_hubla_tx AS (
  SELECT 
    ht.id as tx_id,
    LOWER(ht.customer_email) as email,
    ht.product_name,
    ht.net_value,
    ht.sale_date,
    ht.sale_status,
    ht.event_type,
    ht.product_price,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(ht.customer_email), ht.product_name 
      ORDER BY ht.sale_date ASC
    ) as tx_seq
  FROM hubla_transactions ht
  WHERE ht.total_installments = 1
    AND ht.customer_email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM billing_installments bi 
      WHERE bi.hubla_transaction_id = ht.id
    )
),
overdue_installments AS (
  SELECT 
    bi.id as inst_id,
    bi.subscription_id as sub_id,
    bi.numero_parcela,
    bi.valor_original,
    swo.customer_email,
    swo.product_name,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(swo.customer_email), swo.product_name 
      ORDER BY bi.numero_parcela ASC
    ) as inst_seq
  FROM billing_installments bi
  INNER JOIN subs_with_overdue swo ON swo.sub_id = bi.subscription_id
  WHERE bi.status = 'atrasado'
    AND bi.hubla_transaction_id IS NULL
)
SELECT 
  oi.inst_id,
  oi.sub_id,
  oi.numero_parcela,
  oi.valor_original,
  ut.tx_id,
  ut.net_value as tx_net_value,
  ut.sale_date as tx_sale_date,
  ut.product_price as tx_product_price
FROM overdue_installments oi
INNER JOIN unlinked_hubla_tx ut 
  ON LOWER(oi.customer_email) = ut.email
  AND oi.product_name = ut.product_name
  AND oi.inst_seq = ut.tx_seq;

-- Step 2: Update billing_installments
UPDATE billing_installments bi
SET 
  status = 'pago'::billing_installment_status,
  valor_pago = COALESCE(bm.tx_net_value, bm.tx_product_price, bi.valor_original),
  valor_liquido = bm.tx_net_value,
  data_pagamento = bm.tx_sale_date,
  hubla_transaction_id = bm.tx_id,
  updated_at = NOW()
FROM backfill_matches bm
WHERE bi.id = bm.inst_id;

-- Step 3: Insert billing_history
INSERT INTO billing_history (subscription_id, tipo, valor, responsavel, descricao, status, metadata, created_at)
SELECT 
  bm.sub_id,
  'parcela_paga'::billing_history_type,
  COALESCE(bm.tx_net_value, bm.tx_product_price, bm.valor_original),
  'Sistema (Backfill)',
  'Parcela ' || bm.numero_parcela || ' corrigida - pagamento Hubla (total_installments=1)',
  'confirmado',
  jsonb_build_object('hubla_transaction_id', bm.tx_id, 'numero_parcela', bm.numero_parcela, 'backfill', true),
  bm.tx_sale_date
FROM backfill_matches bm;

-- Step 4: Recalculate subscription status
WITH sub_stats AS (
  SELECT 
    bs.id as sub_id,
    bs.total_parcelas,
    COUNT(*) FILTER (WHERE bi.status = 'pago') as parcelas_pagas,
    COUNT(*) FILTER (WHERE bi.status = 'atrasado') as parcelas_atrasadas
  FROM billing_subscriptions bs
  INNER JOIN billing_installments bi ON bi.subscription_id = bs.id
  WHERE bs.id IN (SELECT DISTINCT sub_id FROM backfill_matches)
  GROUP BY bs.id, bs.total_parcelas
)
UPDATE billing_subscriptions bs
SET 
  status = (CASE 
    WHEN ss.parcelas_pagas >= ss.total_parcelas THEN 'quitada'
    WHEN ss.parcelas_atrasadas > 0 THEN 'atrasada'
    ELSE 'em_dia'
  END)::billing_subscription_status,
  status_quitacao = (CASE 
    WHEN ss.parcelas_pagas >= ss.total_parcelas THEN 'quitado'
    WHEN ss.parcelas_pagas > 0 THEN 'parcialmente_pago'
    ELSE 'em_aberto'
  END)::billing_quitacao_status,
  updated_at = NOW()
FROM sub_stats ss
WHERE bs.id = ss.sub_id;

DROP TABLE IF EXISTS backfill_matches;
