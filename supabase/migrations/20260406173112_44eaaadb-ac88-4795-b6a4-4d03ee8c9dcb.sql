-- Link user_id for consorcio closers who have null user_id
UPDATE public.sdr SET user_id = '5a702a6c-52ef-410b-be39-8a1cda4f10d3' WHERE email = 'victoria.paz@minhacasafinanciada.com' AND user_id IS NULL;
UPDATE public.sdr SET user_id = '411e4b5d-8183-4d6a-b841-88c71d50955f' WHERE email = 'ithaline.clara@minhacasafinanciada.com' AND user_id IS NULL;
UPDATE public.sdr SET user_id = 'e459627e-9cf3-4eb7-b9a2-3ae7f7025935' WHERE email = 'luis.felipe@minhacasafinanciada.com' AND user_id IS NULL;