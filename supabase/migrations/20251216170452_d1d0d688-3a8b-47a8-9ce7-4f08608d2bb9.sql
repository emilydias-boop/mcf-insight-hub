-- Habilitar 4 emails A010 que estão na planilha mas desabilitados no banco
-- Emails: erick.eng@yahoo.com, gabrielsocontato@gmail.com, talescp49@gmail.com, vitorleandro.nunes@hotmail.com
UPDATE hubla_transactions
SET count_in_dashboard = true, updated_at = now()
WHERE LOWER(customer_email) IN (
  'erick.eng@yahoo.com',
  'gabrielsocontato@gmail.com',
  'talescp49@gmail.com',
  'vitorleandro.nunes@hotmail.com'
)
AND (product_category = 'a010' OR product_name ILIKE '%A010%')
AND DATE(sale_date AT TIME ZONE 'America/Sao_Paulo') >= '2025-12-13'
AND DATE(sale_date AT TIME ZONE 'America/Sao_Paulo') <= '2025-12-16'
AND source = 'make'
AND net_value > 0;