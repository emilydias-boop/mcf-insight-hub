DROP POLICY IF EXISTS "Users can view pending registrations" ON public.consorcio_pending_registrations;
CREATE POLICY "Authenticated users can view pending registrations"
ON public.consorcio_pending_registrations
FOR SELECT
TO authenticated
USING (true);