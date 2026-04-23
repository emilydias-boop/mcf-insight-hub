-- Andre Duarte: remover histórico espúrio e estender incorporador até a data de cadastro
DELETE FROM public.sdr_squad_history
WHERE sdr_id = '6533ee88-398a-4625-958f-80412f091339'
  AND squad IN ('a010', 'inside sales produto');

UPDATE public.sdr_squad_history
SET valid_from = '2026-04-20 20:59:58.431804+00'
WHERE sdr_id = '6533ee88-398a-4625-958f-80412f091339'
  AND squad = 'incorporador';

-- Nicola Ricci: mesmo tratamento
DELETE FROM public.sdr_squad_history
WHERE sdr_id = '3d312772-1bfe-4e55-8865-b525006adaa7'
  AND squad IN ('a010', 'inside sales produto');

UPDATE public.sdr_squad_history
SET valid_from = '2026-04-22 17:06:42.458965+00'
WHERE sdr_id = '3d312772-1bfe-4e55-8865-b525006adaa7'
  AND squad = 'incorporador';