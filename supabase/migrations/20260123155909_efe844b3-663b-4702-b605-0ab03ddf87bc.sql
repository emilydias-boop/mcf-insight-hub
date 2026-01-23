-- Remove test transactions (R$5 sales for test emails)
DELETE FROM hubla_transactions 
WHERE customer_email IN ('matheusrom.4@gmail.com', 'matheus.teste@example.com') 
AND net_value <= 10;

-- Add excluded_from_cart column for soft-delete from cart view
ALTER TABLE hubla_transactions 
ADD COLUMN IF NOT EXISTS excluded_from_cart BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN hubla_transactions.excluded_from_cart IS 
'When TRUE, transaction is excluded from Bruto KPI but still counts in Liquido';