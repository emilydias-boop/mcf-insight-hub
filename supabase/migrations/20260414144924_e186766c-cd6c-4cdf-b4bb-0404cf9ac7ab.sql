DROP POLICY IF EXISTS "Users can view their own calls" ON public.calls;

CREATE POLICY "Users can view their own calls"
ON public.calls
FOR SELECT
TO public
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'coordenador'::app_role)
);