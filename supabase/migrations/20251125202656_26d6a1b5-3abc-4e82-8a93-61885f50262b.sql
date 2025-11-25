-- Remove GENERATED columns from weekly_metrics to allow direct import
ALTER TABLE weekly_metrics 
  DROP COLUMN IF EXISTS total_revenue,
  DROP COLUMN IF EXISTS operating_cost,
  DROP COLUMN IF EXISTS operating_profit,
  DROP COLUMN IF EXISTS real_cost;

-- Add columns back as regular numeric fields
ALTER TABLE weekly_metrics
  ADD COLUMN IF NOT EXISTS total_revenue numeric,
  ADD COLUMN IF NOT EXISTS operating_cost numeric,
  ADD COLUMN IF NOT EXISTS operating_profit numeric,
  ADD COLUMN IF NOT EXISTS real_cost numeric;