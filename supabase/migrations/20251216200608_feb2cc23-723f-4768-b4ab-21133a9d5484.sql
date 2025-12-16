
-- Passo 1: Marcar TODAS as transações Make da semana 13-19/12/2025 como count_in_dashboard = true
UPDATE hubla_transactions 
SET count_in_dashboard = true 
WHERE source = 'make' 
  AND sale_date >= '2025-12-13' 
  AND sale_date < '2025-12-20';

-- Passo 2: Excluir parcelas pequenas de contratos (net_value < 100 indica parcela, não venda nova)
UPDATE hubla_transactions 
SET count_in_dashboard = false 
WHERE source = 'make' 
  AND product_name IN ('Contrato', 'A000 - Contrato')
  AND sale_date >= '2025-12-13' 
  AND sale_date < '2025-12-20'
  AND net_value < 100;

-- Passo 3: Excluir também Parceria e Viver de Aluguel (não contam no Faturamento Total)
UPDATE hubla_transactions 
SET count_in_dashboard = false 
WHERE source = 'make' 
  AND product_name IN ('Parceria', 'Viver de Aluguel')
  AND sale_date >= '2025-12-13' 
  AND sale_date < '2025-12-20';
