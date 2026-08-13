GRANT SELECT ON public.sonax_call_events TO authenticated;
GRANT ALL ON public.sonax_call_events TO service_role;

DROP POLICY IF EXISTS "Admins and managers can view sonax call events" ON public.sonax_call_events;

CREATE POLICY "sonax_call_events_select_scoped"
ON public.sonax_call_events
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'coordenador'::app_role)
  OR (
    sonax_call_events.sdr_email IS NOT NULL
    AND lower(sonax_call_events.sdr_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
  OR EXISTS (
    SELECT 1
    FROM public.crm_deals d
    WHERE d.id::text = sonax_call_events.deal_id
      AND (d.owner_id = auth.uid()::text OR d.owner_profile_id = auth.uid())
  )
);