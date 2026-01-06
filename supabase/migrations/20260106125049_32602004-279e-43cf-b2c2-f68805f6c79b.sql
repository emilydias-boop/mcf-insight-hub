-- Permite colaborador atualizar seus próprios dados pessoais
CREATE POLICY "Colaborador pode atualizar seus dados pessoais"
ON public.employees
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());