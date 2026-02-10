
-- Step 1: Atualizar emails nos registros corretos
UPDATE public.sdr SET email = 'ithaline.clara@minhacasafinanciada.com' WHERE id = '3aa83069-7d2a-494d-aebd-ea31815547b4';
UPDATE public.sdr SET email = 'luis.felipe@minhacasafinanciada.com' WHERE id = '17fdd964-1774-4455-973b-7e46bf76ef4d';
UPDATE public.sdr SET email = 'ygor.ferreira@minhacasafinanciada.com' WHERE id = '929e60c5-62d1-4c87-bd96-67a288541acb';
UPDATE public.sdr SET email = 'joao.pedro@minhacasafinanciada.com' WHERE id = '1c6c4acd-c0f2-4125-a195-cb1d4f3b1850';
UPDATE public.sdr SET email = 'victoria.paz@minhacasafinanciada.com' WHERE id = '131c9863-2c11-44a6-a866-6b978ca00748';

-- Step 2: Desativar registros duplicados (ao invés de deletar, para segurança)
UPDATE public.sdr SET active = false WHERE id = '12803e3a-c98e-49a3-85c7-eacd3d6965a3'; -- Ithaline duplicada
UPDATE public.sdr SET active = false WHERE id = 'eee8e90e-db40-40e9-beda-7b30bab86151'; -- Ygor duplicado
