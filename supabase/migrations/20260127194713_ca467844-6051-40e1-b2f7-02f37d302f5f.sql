-- Correção retroativa: Transferir ownership para os closers da R1
-- e preservar a cadeia de ownership

-- 1. Lorena das Graça -> Julio
UPDATE crm_deals SET 
  original_sdr_email = COALESCE(original_sdr_email, owner_id),
  r1_closer_email = 'julio.caetano@minhacasafinanciada.com',
  owner_id = 'julio.caetano@minhacasafinanciada.com',
  updated_at = NOW()
WHERE id = '685a245d-49f7-404e-922e-1d194f82632a';

-- 2. CAIS ENGENHARIA -> Julio
UPDATE crm_deals SET 
  original_sdr_email = COALESCE(original_sdr_email, owner_id),
  r1_closer_email = 'julio.caetano@minhacasafinanciada.com',
  owner_id = 'julio.caetano@minhacasafinanciada.com',
  updated_at = NOW()
WHERE id = '6354770e-29f3-4a28-8c60-5ea044d98fcf';

-- 3. Ana luzia maranini -> Julio
UPDATE crm_deals SET 
  r1_closer_email = 'julio.caetano@minhacasafinanciada.com',
  owner_id = 'julio.caetano@minhacasafinanciada.com',
  updated_at = NOW()
WHERE id = 'cfd65eeb-2c24-4dd3-a8bb-21ce29a3ff6b';

-- 4. Robson Moreira -> Thayna
UPDATE crm_deals SET 
  original_sdr_email = COALESCE(original_sdr_email, owner_id),
  r1_closer_email = 'thaynar.tavares@minhacasafinanciada.com',
  owner_id = 'thaynar.tavares@minhacasafinanciada.com',
  updated_at = NOW()
WHERE id = '4202201f-400e-4109-a16a-34fc61df746f';

-- 5. Mauricio Albuquerque -> Cristiane
UPDATE crm_deals SET 
  original_sdr_email = COALESCE(original_sdr_email, owner_id),
  r1_closer_email = 'cristiane.gomes@minhacasafinanciada.com',
  owner_id = 'cristiane.gomes@minhacasafinanciada.com',
  updated_at = NOW()
WHERE id = 'aea3b827-bbb8-4baa-8305-ecedd23bd5d1';