GRANT DELETE ON public.no_show_validations TO authenticated;

CREATE POLICY "Admins can delete no_show_validations"
ON public.no_show_validations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));