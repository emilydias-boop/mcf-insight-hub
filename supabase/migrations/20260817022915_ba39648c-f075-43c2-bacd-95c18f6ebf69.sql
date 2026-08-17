DROP POLICY IF EXISTS "Authenticated can view termos" ON public.consorcio_termos;

CREATE POLICY "Staff or owner can view termos"
ON public.consorcio_termos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'coordenador')
  OR public.has_role(auth.uid(), 'assistente_administrativo')
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "Managers can update termos" ON public.consorcio_termos;
CREATE POLICY "Staff or owner can update termos"
ON public.consorcio_termos
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'coordenador')
  OR public.has_role(auth.uid(), 'assistente_administrativo')
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "Managers can delete termos" ON public.consorcio_termos;
CREATE POLICY "Managers can delete termos"
ON public.consorcio_termos
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'coordenador')
);