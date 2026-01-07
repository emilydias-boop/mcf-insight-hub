-- Adicionar coluna show_on_tv na tabela profiles
ALTER TABLE profiles 
ADD COLUMN show_on_tv boolean DEFAULT true;

-- Desativar TV para usuarios específicos
UPDATE profiles SET show_on_tv = false 
WHERE email IN (
  'yanca.tavares@minhacasafinanciada.com',
  'cleiton.lima@minhacasafinanciada.com',
  'vitor.ferreira@minhacasafinanciada.com',
  'thobson.motta@minhacasafinanciada.com',
  'julio.caetano@minhacasafinanciada.com'
);