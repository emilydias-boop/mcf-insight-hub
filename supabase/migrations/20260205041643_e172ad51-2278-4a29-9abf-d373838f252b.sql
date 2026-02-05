-- Add last_worked_at column to track when a deal was last worked
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS last_worked_at TIMESTAMPTZ;

-- Initialize with GREATEST between stage_moved_at and created_at
UPDATE crm_deals SET last_worked_at = COALESCE(
  GREATEST(stage_moved_at, created_at),
  created_at
);

-- Trigger function for deal_activities
CREATE OR REPLACE FUNCTION update_deal_last_worked_from_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE crm_deals 
  SET last_worked_at = GREATEST(
    COALESCE(last_worked_at, '1970-01-01'::timestamptz),
    NEW.created_at
  )
  WHERE clint_id = NEW.deal_id OR id::text = NEW.deal_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for deal_activities
DROP TRIGGER IF EXISTS trigger_deal_activity_last_worked ON deal_activities;
CREATE TRIGGER trigger_deal_activity_last_worked
AFTER INSERT ON deal_activities
FOR EACH ROW EXECUTE FUNCTION update_deal_last_worked_from_activity();

-- Trigger function for calls
CREATE OR REPLACE FUNCTION update_deal_last_worked_from_call()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deal_id IS NOT NULL THEN
    UPDATE crm_deals 
    SET last_worked_at = GREATEST(
      COALESCE(last_worked_at, '1970-01-01'::timestamptz),
      NEW.created_at
    )
    WHERE id = NEW.deal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for calls
DROP TRIGGER IF EXISTS trigger_call_last_worked ON calls;
CREATE TRIGGER trigger_call_last_worked
AFTER INSERT ON calls
FOR EACH ROW EXECUTE FUNCTION update_deal_last_worked_from_call();