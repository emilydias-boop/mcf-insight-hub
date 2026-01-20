-- Adicionar colunas squad e role_type na tabela sdr
ALTER TABLE public.sdr ADD COLUMN IF NOT EXISTS squad text;
ALTER TABLE public.sdr ADD COLUMN IF NOT EXISTS role_type text DEFAULT 'sdr';

-- Atualizar squad baseado no email vinculado ao profiles
UPDATE public.sdr s
SET squad = p.squad
FROM public.profiles p
WHERE p.email = s.email AND s.squad IS NULL;

-- Atualizar role_type baseado no user_roles
UPDATE public.sdr s
SET role_type = COALESCE(
  (SELECT ur.role::text FROM public.profiles p 
   JOIN public.user_roles ur ON p.id = ur.user_id 
   WHERE p.email = s.email
   LIMIT 1),
  'sdr'
);

-- Corrigir Angelina (desligada)
UPDATE public.sdr SET active = false WHERE email = 'angelina.maia@minhacasafinanciada.com';

-- Atualizar squads específicos conhecidos
UPDATE public.sdr SET squad = 'projetos' WHERE email = 'vitor.ferreira@minhacasafinanciada.com';
UPDATE public.sdr SET squad = 'consorcio' WHERE email = 'cleiton.lima@minhacasafinanciada.com';

-- Garantir que SDRs do incorporador estejam corretos
UPDATE public.sdr SET squad = 'incorporador' WHERE squad IS NULL AND active = true;