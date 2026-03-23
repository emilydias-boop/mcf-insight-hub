ALTER TABLE dashboard_preferences 
ADD COLUMN IF NOT EXISTS notify_email boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_push boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_sms boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_critical boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_daily_summary boolean DEFAULT true;