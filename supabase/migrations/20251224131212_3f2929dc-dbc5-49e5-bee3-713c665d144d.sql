-- Atualizar valores fixos para a semana 13-19/12/25
UPDATE weekly_metrics 
SET 
  total_revenue = 170819.17,
  faturamento_total = 170819.17,
  ads_cost = 99133.05,
  cpl = 436.71,
  operating_cost = 127639.55,
  total_cost = 127639.55,
  operating_profit = 43179.62,
  roi = 138.17,
  roas = 1.72,
  ultrameta_clint = 381360.00,
  clint_revenue = 233341.00,
  faturamento_clint = 233341.00,
  ultrameta_liquido = 317800.00,
  incorporador_50k = 156309.08,
  updated_at = NOW()
WHERE start_date = '2025-12-13' AND end_date = '2025-12-19';