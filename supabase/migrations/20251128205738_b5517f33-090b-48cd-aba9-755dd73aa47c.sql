-- Limpar transações importadas com valores errados
DELETE FROM hubla_transactions 
WHERE event_type = 'invoice.payment_succeeded';