-- Add appearance preference columns to dashboard_preferences
ALTER TABLE dashboard_preferences 
ADD COLUMN IF NOT EXISTS theme text DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
ADD COLUMN IF NOT EXISTS font_size text DEFAULT 'small' CHECK (font_size IN ('small', 'medium', 'large'));