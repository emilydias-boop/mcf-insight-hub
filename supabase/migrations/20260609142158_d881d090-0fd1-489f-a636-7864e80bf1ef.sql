
-- 1) Apaga segmento errado (inside sales produto)
DELETE FROM public.sdr_squad_history
WHERE id = '93dd91d1-7962-4e8f-b434-d397e9327fe0';

-- 2) Estende o segmento anterior de incorporador até onde o segmento errado terminava (09/06 14:05:08)
UPDATE public.sdr_squad_history
SET valid_to = '2026-06-09 14:05:08.849893+00'
WHERE id = 'd5922f16-ee46-4fcc-becd-e40bf5cc92e9';
