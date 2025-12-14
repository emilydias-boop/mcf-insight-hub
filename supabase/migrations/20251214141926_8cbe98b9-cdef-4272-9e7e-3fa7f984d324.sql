-- Add notes column to crm_contacts for contact observations
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN crm_contacts.notes IS 'General observations about the contact, useful for future interactions';