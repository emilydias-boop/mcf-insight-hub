-- meeting_slots: permitir manager e coordenador deletar
DROP POLICY IF EXISTS "Admins can delete meeting slots" ON meeting_slots;
CREATE POLICY "Authorized roles can delete meeting slots" ON meeting_slots
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'coordenador'::app_role)
  );

-- meeting_slot_attendees: permitir manager e coordenador deletar
DROP POLICY IF EXISTS "Admins can delete attendees" ON meeting_slot_attendees;
CREATE POLICY "Authorized roles can delete attendees" ON meeting_slot_attendees
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'coordenador'::app_role)
  );