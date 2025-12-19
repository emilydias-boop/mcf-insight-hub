-- Correção: Setar count_in_dashboard = true para todas as transações Make que estão incorretas
UPDATE hubla_transactions 
SET count_in_dashboard = true,
    updated_at = NOW()
WHERE source = 'make' 
  AND (count_in_dashboard = false OR count_in_dashboard IS NULL)
  AND product_category IN ('parceria', 'contrato', 'viver_aluguel', 'a010', 'ob_construir', 'ob_evento', 'ob_vitalicio');