DROP POLICY IF EXISTS "Authenticated users can view attendees" ON public.meeting_slot_attendees;

CREATE POLICY "Staff can view attendees" ON public.meeting_slot_attendees FOR SELECT TO authenticated
USING (
  public.can_access_consorcio_pii(auth.uid())
  OR public.has_role(auth.uid(), 'marketing')
  OR public.has_role(auth.uid(), 'rh')
);