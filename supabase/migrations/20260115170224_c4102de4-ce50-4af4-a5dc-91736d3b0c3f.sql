-- Add priority column to closers table
ALTER TABLE closers ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 99;

-- Insert the 3 R2 Closers with priorities
INSERT INTO closers (name, email, meeting_type, is_active, priority)
VALUES 
  ('Claudia Carielo', 'claudia.carielo@minhacasafinanciada.com', 'r2', true, 1),
  ('Jessica Bellini', 'jessica.bellini@minhacasafinanciada.com', 'r2', true, 2),
  ('Thobson Motta', 'thobson.motta@minhacasafinanciada.com', 'r2', true, 3)
ON CONFLICT (email) DO UPDATE SET
  meeting_type = EXCLUDED.meeting_type,
  is_active = EXCLUDED.is_active,
  priority = EXCLUDED.priority
WHERE closers.meeting_type = 'r2' OR closers.meeting_type IS NULL;