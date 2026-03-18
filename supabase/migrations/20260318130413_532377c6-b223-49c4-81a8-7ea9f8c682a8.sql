-- Corrigir squad dos 3 SDRs para incorporador
UPDATE sdr SET squad = 'incorporador'
WHERE email IN (
  'hellen.costa@minhacasafinanciada.com',
  'marcio.dantas@minhacasafinanciada.com',
  'mayara.souza@minhacasafinanciada.com'
);

-- Corrigir departamento dos employees para evitar reincidência
UPDATE employees SET departamento = 'BU - Incorporador 50K'
WHERE id IN (
  '87b21ce1-e9c7-4b7c-8b3c-8f29ba179ed7',
  '47f20a2a-c4e9-41a5-bf91-23ce0149b079',
  '40f66bf5-63c7-40d5-b4c7-3eca5fed1113'
);