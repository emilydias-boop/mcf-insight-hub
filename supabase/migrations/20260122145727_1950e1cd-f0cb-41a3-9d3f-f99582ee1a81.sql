-- Allow managers, admins, and coordenadores to view all user roles for lead transfer
CREATE POLICY "Managers can view all user roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'coordenador'::app_role) OR
  user_id = auth.uid()
);

-- Allow managers, admins, and coordenadores to view team profiles for lead transfer
CREATE POLICY "Managers can view team profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'coordenador'::app_role) OR
  id = auth.uid()
);