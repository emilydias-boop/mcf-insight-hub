-- Atualizar weekly_metrics para 206 vendas A010 (conforme planilha do usuário)
-- Metodologia: contagem de linhas da planilha (inclui duplicados)

UPDATE weekly_metrics 
SET 
  a010_sales = 206,
  ultrameta_clint = 346080,       -- 206 × R$ 1.680
  ultrameta_liquido = 288400,     -- 206 × R$ 1.400
  cpl = 442.42,                   -- R$ 91.138,76 ÷ 206
  updated_at = now()
WHERE start_date = '2025-11-29' AND end_date = '2025-12-05';