
-- Fix valor_pago: parcela 1 = product_price (bruto), demais = net_value (líquido)
UPDATE billing_installments bi
SET 
  valor_pago = CASE 
    WHEN bi.numero_parcela = 1 THEN COALESCE(NULLIF(ht.product_price, 0), bi.valor_original)
    ELSE COALESCE(NULLIF(ht.net_value, 0), ht.product_price, bi.valor_original)
  END,
  updated_at = now()
FROM hubla_transactions ht
WHERE bi.hubla_transaction_id = ht.id
  AND bi.status = 'pago';

-- Recalculate status_quitacao for all subscriptions with hubla-linked installments
WITH sub_stats AS (
  SELECT 
    bs.id,
    bs.total_parcelas,
    COUNT(*) FILTER (WHERE i.status = 'pago') as parcelas_pagas,
    COUNT(*) FILTER (WHERE i.status = 'atrasado') as parcelas_atrasadas
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
