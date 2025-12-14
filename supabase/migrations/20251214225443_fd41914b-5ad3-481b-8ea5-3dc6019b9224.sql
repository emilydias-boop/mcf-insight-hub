-- Add funnel_stages column to dashboard_preferences
ALTER TABLE dashboard_preferences 
ADD COLUMN IF NOT EXISTS funnel_stages text[] 
DEFAULT ARRAY['a8365215-fd31-4bdc-bbe7-77100fa39e53', '34995d75-933e-4d67-b7fc-19fcb8b81680', '062927f5-b7a3-496a-9d47-eb03b3d69b10', '3a2776e2-a536-4a2a-bb7b-a2f53c8941df'];