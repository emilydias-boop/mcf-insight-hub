ALTER TABLE public.consorcio_pending_registrations
  ADD COLUMN IF NOT EXISTS parcela_1a_12a numeric,
  ADD COLUMN IF NOT EXISTS parcela_demais numeric,
  ADD COLUMN IF NOT EXISTS credito_id uuid REFERENCES public.consorcio_creditos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS objetivo text;

CREATE POLICY "Admins e managers inserem creditos"
  ON public.consorcio_creditos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins e managers atualizam creditos"
  ON public.consorcio_creditos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins e managers excluem creditos"
  ON public.consorcio_creditos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));