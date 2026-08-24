DROP POLICY "Managers can update pending registrations" ON public.consorcio_pending_registrations;

CREATE POLICY "Managers can update pending registrations"
ON public.consorcio_pending_registrations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'coordenador'::app_role, 'closer'::app_role, 'cobranca_consorcio'::app_role])
  )
);