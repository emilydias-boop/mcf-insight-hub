-- Corrigir timezone do registro do Marcio Gonzaga Jr.
-- sale_date estava salvo como 15:40 UTC, mas deveria ser 18:40 UTC (15:40 BRT + 3h)
UPDATE hubla_transactions
SET sale_date = sale_date + INTERVAL '3 hours'
WHERE id = '1f547485-3b70-4f20-b1c5-6f7e565395a4';