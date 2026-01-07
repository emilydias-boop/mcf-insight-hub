-- Desativar usuários adicionais da TV SDR
UPDATE profiles 
SET show_on_tv = false 
WHERE email IN (
  'jessica.bellini@minhacasafinanciada.com',
  'vinicius.motta@minhacasafinanciada.com',
  'grimaldo.neto@minhacasafinanciada.com',
  'luis.felipe@minhacasafinanciada.com',
  'matheus.rodrigues@minhacasafinanciada.com',
  'jessicamartinsmarques@minhacasafinanciada.com.br'
);