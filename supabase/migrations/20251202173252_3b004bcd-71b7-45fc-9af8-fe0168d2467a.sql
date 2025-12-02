-- Add new columns to hubla_transactions for correct value tracking
ALTER TABLE hubla_transactions ADD COLUMN IF NOT EXISTS net_value numeric DEFAULT 0;
ALTER TABLE hubla_transactions ADD COLUMN IF NOT EXISTS subtotal_cents integer;
ALTER TABLE hubla_transactions ADD COLUMN IF NOT EXISTS installment_fee_cents integer DEFAULT 0;
ALTER TABLE hubla_transactions ADD COLUMN IF NOT EXISTS installment_number integer DEFAULT 1;
ALTER TABLE hubla_transactions ADD COLUMN IF NOT EXISTS total_installments integer DEFAULT 1;
ALTER TABLE hubla_transactions ADD COLUMN IF NOT EXISTS is_offer boolean DEFAULT false;

-- Add index for better query performance on incorporador calculations
CREATE INDEX IF NOT EXISTS idx_hubla_transactions_category_date ON hubla_transactions(product_category, sale_date);
CREATE INDEX IF NOT EXISTS idx_hubla_transactions_net_value ON hubla_transactions(net_value) WHERE net_value > 0;