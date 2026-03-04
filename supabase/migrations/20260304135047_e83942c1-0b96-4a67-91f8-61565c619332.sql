ALTER TABLE sdr_month_payout 
  ADD COLUMN IF NOT EXISTS nivel_vigente integer,
  ADD COLUMN IF NOT EXISTS cargo_vigente text;