-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Admins and coordenadores can update attendees" ON public.meeting_slot_attendees;

-- Create new UPDATE policy including closers
CREATE POLICY "Admins, coordenadores and closers can update attendees" 
  ON public.meeting_slot_attendees
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'coordenador'::app_role) OR
    has_role(auth.uid(), 'closer'::app_role)
  );