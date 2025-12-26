-- Sincronizar faturamento_total com total_revenue (valores aprovados pela Emily)
UPDATE weekly_metrics 
SET faturamento_total = total_revenue 
WHERE total_revenue IS NOT NULL 
  AND total_revenue > 0 
  AND (faturamento_total IS NULL OR ABS(faturamento_total - total_revenue) > 1);