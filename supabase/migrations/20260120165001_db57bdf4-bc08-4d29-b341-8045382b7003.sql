-- Insert active closers into sdr table with role_type = 'closer'
-- Only insert those not already in sdr table

INSERT INTO sdr (id, name, email, active, role_type, squad, nivel, meta_diaria)
SELECT 
  gen_random_uuid(),
  c.name,
  c.email,
  true,
  'closer',
  'incorporador',
  1,
  0
FROM closers c
WHERE c.is_active = true
AND c.email NOT IN (SELECT email FROM sdr WHERE email IS NOT NULL);

-- This will add:
-- - Claudia Carielo (claudia.carielo@minhacasafinanciada.com)
-- - Jessica Bellini (jessica.bellini.r2@minhacasafinanciada.com) 
-- - Julio (julio.caetano@minhacasafinanciada.com)
-- - Thayna (thaynar.tavares@minhacasafinanciada.com)
-- - Thobson Motta (thobson.motta@minhacasafinanciada.com)