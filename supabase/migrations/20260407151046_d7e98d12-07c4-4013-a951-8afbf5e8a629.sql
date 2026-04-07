
-- Fix 1: Vincular user_id nos 4 SDRs sem vinculo
UPDATE public.sdr SET user_id = '16c5d025-9cda-45fa-ae2f-7170bfb8dee8' WHERE id = '72e86638-a711-4cec-8575-e64ff47544bb';
UPDATE public.sdr SET user_id = 'dd76c153-a4a5-432e-ab4c-0b48f6141659' WHERE id = '21393c7b-faa7-42e2-b1d8-920e3a808b33';
UPDATE public.sdr SET user_id = '6bb81a27-fd8f-4af8-bce0-377f3576124f' WHERE id = '66a5a9ea-6d48-4831-b91c-7d79cf00aac2';
UPDATE public.sdr SET user_id = '15f3eba4-83eb-4c19-9847-870bbdebc537' WHERE id = '11111111-0001-0001-0001-000000000012';

-- Fix 2: Sincronizar employees.user_id com profile_id onde user_id está NULL
UPDATE public.employees SET user_id = profile_id WHERE user_id IS NULL AND profile_id IS NOT NULL;
