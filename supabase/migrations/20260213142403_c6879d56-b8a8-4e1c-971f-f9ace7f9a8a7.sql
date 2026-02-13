-- Índice para acelerar a subquery EXISTS de deduplicação Make/Hubla
-- Usa sale_date diretamente (sem cast para date) + source + lower(email)
CREATE INDEX IF NOT EXISTS idx_hubla_dedup_email_source 
ON hubla_transactions (lower(customer_email), source, sale_date)
WHERE net_value > 0;

-- Índice para acelerar o JOIN e filtros principais
CREATE INDEX IF NOT EXISTS idx_hubla_product_name_date 
ON hubla_transactions (product_name, sale_date)
WHERE sale_status IN ('completed', 'refunded') 
  AND source IN ('hubla', 'manual', 'make');