
CREATE OR REPLACE FUNCTION public.is_my_employee_folder(_folder text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id::text = _folder
      AND (
        e.user_id = auth.uid()
        OR e.profile_id = auth.uid()
        OR lower(e.email_pessoal) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
      )
  )
$$;

DROP POLICY IF EXISTS "Usuários autenticados podem visualizar arquivos do bucket user" ON storage.objects;

CREATE POLICY "RH e admins podem visualizar arquivos user-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-files'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'rh')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'coordenador')
  )
);

CREATE POLICY "Colaborador visualiza apenas seus arquivos user-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-files'
  AND (
    public.is_my_employee_folder((storage.foldername(name))[1])
    OR (
      (storage.foldername(name))[1] = 'rh-tickets'
      AND public.is_my_employee_folder((storage.foldername(name))[2])
    )
  )
);
