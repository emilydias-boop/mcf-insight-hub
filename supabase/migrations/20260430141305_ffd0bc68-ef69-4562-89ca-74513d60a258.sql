UPDATE public.profiles
SET squad = ARRAY['incorporador']::text[]
WHERE id IN (
  '1cb9287f-9ee6-4724-90ca-b65860199193', -- Andre dos Santos Duarte
  '7aa935e2-73e1-4624-b189-aa9784e29485'  -- Nicola Ricci
);