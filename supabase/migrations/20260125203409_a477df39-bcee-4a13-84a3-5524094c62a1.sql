-- Add columns to preserve the complete ownership chain (SDR → Closer R1 → Closer R2)
ALTER TABLE crm_deals 
ADD COLUMN IF NOT EXISTS r1_closer_email TEXT,
ADD COLUMN IF NOT EXISTS r2_closer_email TEXT;

-- Add comments for documentation
COMMENT ON COLUMN crm_deals.original_sdr_email IS 'SDR que originou o lead (preservado na primeira transferência)';
COMMENT ON COLUMN crm_deals.r1_closer_email IS 'Closer R1 que realizou a primeira reunião';
COMMENT ON COLUMN crm_deals.r2_closer_email IS 'Closer R2 que realizou a segunda reunião';

-- Clear original_sdr_email values that were incorrectly set with closer emails
UPDATE crm_deals 
SET original_sdr_email = NULL
WHERE original_sdr_email IN (
  SELECT email FROM closers WHERE is_active = true
);