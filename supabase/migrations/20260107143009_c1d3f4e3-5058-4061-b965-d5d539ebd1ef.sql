-- Enable realtime for crm_deals table
ALTER TABLE crm_deals REPLICA IDENTITY FULL;

-- Add to realtime publication (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE crm_deals;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;