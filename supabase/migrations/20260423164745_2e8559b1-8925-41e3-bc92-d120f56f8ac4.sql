UPDATE public.sdr
SET squad = 'incorporador', updated_at = now()
WHERE email IN (
  'andre.duarte@minhacasafinanciada.com',
  'nicola.ricci@minhacasafinanciada.com'
);