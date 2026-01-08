
-- Insert Cristiane Gomes as closer
INSERT INTO closers (name, email, is_active, color, employee_id, google_calendar_enabled)
VALUES (
  'Cristiane Gomes',
  'cristiane.gomes@minhacasafinanciada.com',
  true,
  '#EC4899',
  '07ca8150-5a9d-4be6-8bba-bb1bcd2b169d',
  false
);

-- Update colors for differentiation
UPDATE closers SET color = '#8B5CF6' WHERE name = 'Thayna';
UPDATE closers SET color = '#10B981' WHERE name = 'Jessica Bellini';

-- Deactivate Jessica Bellini (only Cristiane, Julio, Thayna doing R1)
UPDATE closers SET is_active = false WHERE name = 'Jessica Bellini';
