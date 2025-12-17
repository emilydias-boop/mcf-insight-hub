-- Add new columns to profiles table for access management
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS access_status text DEFAULT 'ativo' CHECK (access_status IN ('ativo', 'bloqueado', 'desativado')),
ADD COLUMN IF NOT EXISTS blocked_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS squad text;

-- Create user_integrations table
CREATE TABLE IF NOT EXISTS user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  clint_user_id text,
  twilio_agent_id text,
  other_integrations jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on user_integrations
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_integrations
CREATE POLICY "Admins can manage user integrations"
ON user_integrations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own integrations"
ON user_integrations
FOR SELECT
USING (user_id = auth.uid());

-- Create trigger for updated_at on user_integrations
CREATE TRIGGER update_user_integrations_updated_at
BEFORE UPDATE ON user_integrations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();