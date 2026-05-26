CREATE POLICY "Managers can delete pending registrations"
ON public.consorcio_pending_registrations
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'coordenador'::app_role])
  )
);

-- Also clean up linked documents (delete policy on consortium_documents may also be missing for this case)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.consortium_documents'::regclass
      AND polcmd = 'd'
  ) THEN
    EXECUTE 'CREATE POLICY "Managers can delete consortium documents"
      ON public.consortium_documents
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = ANY (ARRAY[''admin''::app_role, ''manager''::app_role, ''coordenador''::app_role])
        )
      )';
  END IF;
END $$;