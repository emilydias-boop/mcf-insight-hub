-- Permitir que admins e managers atualizem perfis de outros usuários
CREATE POLICY "Admins and managers can update any profile"
ON public.profiles
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'manager'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'manager'::public.app_role)
);