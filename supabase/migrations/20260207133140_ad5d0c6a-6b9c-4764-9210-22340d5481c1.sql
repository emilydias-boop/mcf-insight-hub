-- Add missing SDRs: Evellyn and Roger
-- Then move Vinicius from incorporador to credito

-- Insert Evellyn (from profiles data)
INSERT INTO public.sdr (name, email, squad, role_type, active, user_id, meta_diaria)
SELECT 
  'Evellyn Vieira dos Santos',
  'evellyn.santos@minhacasafinanciada.com',
  'incorporador',
  'sdr',
  true,
  '5ac53d91-e131-4abb-9a8a-04745864a509',
  10
WHERE NOT EXISTS (
  SELECT 1 FROM public.sdr WHERE email = 'evellyn.santos@minhacasafinanciada.com'
);

-- Insert Roger (from profiles data)
INSERT INTO public.sdr (name, email, squad, role_type, active, user_id, meta_diaria)
SELECT 
  'Robert Roger Santos Gusmão',
  'robert.gusmao@minhacasafinanciada.com',
  'incorporador',
  'sdr',
  true,
  'f12d079b-8c99-49b4-9233-4705886e079b',
  10
WHERE NOT EXISTS (
  SELECT 1 FROM public.sdr WHERE email = 'robert.gusmao@minhacasafinanciada.com'
);

-- Move Vinicius from incorporador to credito
UPDATE public.sdr 
SET squad = 'credito' 
WHERE email = 'rangel.vinicius@minhacasafinanciada.com';