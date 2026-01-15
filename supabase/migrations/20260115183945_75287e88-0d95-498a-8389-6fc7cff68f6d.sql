-- Inserir employees faltantes para closers
INSERT INTO employees (id, nome_completo, email_pessoal, cargo, squad, data_admissao, status, tipo_contrato)
VALUES 
  (gen_random_uuid(), 'Julio Caetano', 'julio.caetano@minhacasafinanciada.com', 'Closer', 'Comercial', '2024-01-01', 'ativo', 'clt'),
  (gen_random_uuid(), 'Thaynar Tavares', 'thaynar.tavares@minhacasafinanciada.com', 'Closer', 'Comercial', '2024-01-01', 'ativo', 'clt'),
  (gen_random_uuid(), 'Claudia Carielo', 'claudia.carielo@minhacasafinanciada.com', 'Closer R2', 'Comercial', '2024-01-01', 'ativo', 'clt'),
  (gen_random_uuid(), 'Thobson Motta', 'thobson.motta@minhacasafinanciada.com', 'Closer R2', 'Comercial', '2024-01-01', 'ativo', 'clt'),
  (gen_random_uuid(), 'Jessica Bellini R2', 'jessica.bellini.r2@minhacasafinanciada.com', 'Closer R2', 'Comercial', '2024-01-01', 'ativo', 'clt');

-- Vincular closers aos employees (usando subqueries)
UPDATE closers 
SET employee_id = (SELECT id FROM employees WHERE email_pessoal = 'julio.caetano@minhacasafinanciada.com' LIMIT 1)
WHERE email = 'julio.caetano@minhacasafinanciada.com';

UPDATE closers 
SET employee_id = (SELECT id FROM employees WHERE email_pessoal = 'thaynar.tavares@minhacasafinanciada.com' LIMIT 1)
WHERE email = 'thaynar.tavares@minhacasafinanciada.com';

UPDATE closers 
SET employee_id = (SELECT id FROM employees WHERE email_pessoal = 'claudia.carielo@minhacasafinanciada.com' LIMIT 1)
WHERE email = 'claudia.carielo@minhacasafinanciada.com';

UPDATE closers 
SET employee_id = (SELECT id FROM employees WHERE email_pessoal = 'thobson.motta@minhacasafinanciada.com' LIMIT 1)
WHERE email = 'thobson.motta@minhacasafinanciada.com';

UPDATE closers 
SET employee_id = (SELECT id FROM employees WHERE email_pessoal = 'jessica.bellini.r2@minhacasafinanciada.com' LIMIT 1)
WHERE email = 'jessica.bellini@minhacasafinanciada.com';