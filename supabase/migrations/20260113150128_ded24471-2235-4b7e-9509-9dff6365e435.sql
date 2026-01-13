-- Corrigir emails dos closers para bater com os profiles

-- Julio: julio@... → julio.caetano@...
UPDATE closers 
SET email = 'julio.caetano@minhacasafinanciada.com'
WHERE id = '697b1c04-6dd0-4955-8f33-2e0bcfaad007';

-- Thayna: thayna@... → thaynar.tavares@...
UPDATE closers 
SET email = 'thaynar.tavares@minhacasafinanciada.com'
WHERE id = '1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a';