
CREATE POLICY "Gestao can view vinculo audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    action IN ('pending_deal_link_changed', 'pending_deal_link_created', 'attendee_booked_by_changed')
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'coordenador'::app_role)
    )
  );
