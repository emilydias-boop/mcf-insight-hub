
-- Insert Emily Dias as a new closer
INSERT INTO closers (name, email, color, is_active, calendly_default_link)
VALUES (
  'Emily Dias',
  'emily.dias@minhacasafinanciada.com',
  '#8B5CF6',
  true,
  'https://calendly.com/emily-dias-minhacasafinanciada/reuniao-r01'
);

-- Update the 12:30 meeting (15:30 UTC) to assign Emily
UPDATE meeting_slots 
SET 
  closer_id = (SELECT id FROM closers WHERE email = 'emily.dias@minhacasafinanciada.com' LIMIT 1),
  meeting_link = 'https://calendly.com/emily-dias-minhacasafinanciada/reuniao-r01',
  updated_at = now()
WHERE scheduled_at::time = '15:30:00'
  AND scheduled_at::date = CURRENT_DATE
  AND status IN ('scheduled', 'rescheduled');
