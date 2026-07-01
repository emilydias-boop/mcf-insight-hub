
CREATE TABLE IF NOT EXISTS public.consorcio_bi_metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_ref DATE NOT NULL UNIQUE,
  meta_valor NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consorcio_bi_metas TO authenticated;
GRANT ALL ON public.consorcio_bi_metas TO service_role;
ALTER TABLE public.consorcio_bi_metas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_bi_consorcio_meta(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND lower(email) IN (
        'thobson.motta@minhacasafinanciada.com',
        'jessica.bellini@minhacasafinanciada.com',
        'jessica.bellini.r2@minhacasafinanciada.com'
      )
  );
$$;

CREATE POLICY "bi metas select auth" ON public.consorcio_bi_metas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bi metas insert restricted" ON public.consorcio_bi_metas
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_bi_consorcio_meta(auth.uid()));
CREATE POLICY "bi metas update restricted" ON public.consorcio_bi_metas
  FOR UPDATE TO authenticated USING (public.can_edit_bi_consorcio_meta(auth.uid())) WITH CHECK (public.can_edit_bi_consorcio_meta(auth.uid()));
CREATE POLICY "bi metas delete restricted" ON public.consorcio_bi_metas
  FOR DELETE TO authenticated USING (public.can_edit_bi_consorcio_meta(auth.uid()));
