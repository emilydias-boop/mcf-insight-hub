UPDATE public.sdr
SET allowed_origin_ids = ARRAY[
  '7431cf4a-dc29-4208-95a6-28a499a06dac'::uuid,
  'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'::uuid
],
updated_at = now()
WHERE email = 'antony.elias@minhacasafinanciada.com';