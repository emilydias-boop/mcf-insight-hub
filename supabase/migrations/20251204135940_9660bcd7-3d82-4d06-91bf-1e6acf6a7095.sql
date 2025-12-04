-- Inserir custo de ads do dia 02/12/2025
INSERT INTO daily_costs (date, amount, cost_type, source, campaign_name)
VALUES ('2025-12-02', 14442.45, 'ads', 'facebook', 'Campanha Geral')
ON CONFLICT (date, cost_type, source) DO UPDATE SET 
  amount = EXCLUDED.amount,
  updated_at = now();