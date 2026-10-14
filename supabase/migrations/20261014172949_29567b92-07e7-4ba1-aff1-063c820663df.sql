CREATE TABLE IF NOT EXISTS public.bkp_sdr_karen_20261014 AS SELECT id, allowed_origin_ids, now() AS backup_em FROM public.sdr WHERE id='86880ed1-4bf1-4ea2-8fc5-e5ff673bf139';
GRANT SELECT ON public.bkp_sdr_karen_20261014 TO authenticated;
GRANT ALL ON public.bkp_sdr_karen_20261014 TO service_role;
ALTER TABLE public.bkp_sdr_karen_20261014 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente admin le backup" ON public.bkp_sdr_karen_20261014 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
UPDATE public.sdr SET allowed_origin_ids = ARRAY['b05a0000-0000-4000-8000-000000000002','c4ed1700-0000-4000-8000-000000000002']::uuid[] WHERE id='86880ed1-4bf1-4ea2-8fc5-e5ff673bf139';