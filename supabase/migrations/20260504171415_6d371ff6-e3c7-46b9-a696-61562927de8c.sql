CREATE POLICY "Leadership can delete validations"
ON public.no_show_validations
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'coordenador'::app_role)
);