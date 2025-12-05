-- FASE 1: Corrigir BUG do net_value em centavos (CSV imports)
-- Transações importadas via CSV têm net_value em centavos (ex: 134346 ao invés de 1343.46)
-- Identificamos CSV imports pelo campo raw_data->>'Data de pagamento' que só existe em CSVs

UPDATE hubla_transactions
SET net_value = net_value / 100,
    updated_at = now()
WHERE net_value > 10000
  AND raw_data->>'Data de pagamento' IS NOT NULL;

-- FASE 2: Atualizar weekly_metrics com valores EXATOS da planilha
-- Semana 29/11-05/12/2025 - Valores validados pelo usuário

UPDATE weekly_metrics 
SET 
  -- Vendas A010 e Ultrametas
  a010_sales = 207,
  ultrameta_clint = 347760,        -- 207 × R$ 1.680
  ultrameta_liquido = 289800,      -- 207 × R$ 1.400
  
  -- Faturamentos (valores exatos da planilha)
  faturamento_clint = 51987,       -- Bruto R$ 51.987,00
  incorporador_50k = 41594.91,     -- Líquido R$ 41.594,91
  faturamento_total = 54470.56,    -- R$ 54.470,56
  
  -- Custos
  ads_cost = 91138.76,
  total_cost = 119645.26,
  operating_cost = 119645.26,
  
  -- Métricas derivadas
  operating_profit = -65174.70,    -- Lucro
  cpl = 440.28,                    -- R$ 91.138,76 ÷ 207
  roi = 38.96,                     -- Incorporador / Custo Total * 100
  roas = 0.60,                     -- Faturamento Total / Ads
  
  updated_at = now()
WHERE start_date = '2025-11-29' AND end_date = '2025-12-05';