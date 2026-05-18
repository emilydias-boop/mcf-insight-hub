
-- Corrigir squad da Mayara: reverter troca momentânea de hoje (18/05/2026)
-- Remove rows criadas hoje e mantém incorporador contínuo
DELETE FROM public.sdr_squad_history 
WHERE id IN (
  '7b4c2657-5fa6-4362-a37c-c8e072a83286',
  '92f3daa2-5b50-457f-8109-9d4fce7b94a0',
  'bbea405e-1e0a-42e9-a29b-5f867dbc416c'
);

UPDATE public.sdr_squad_history 
SET valid_to = NULL 
WHERE id = '0c1106a7-07e9-4809-9ced-2771b6fd6b11';

UPDATE public.employees 
SET squad = 'incorporador' 
WHERE id = '40f66bf5-63c7-40d5-b4c7-3eca5fed1113';
