-- 1. Helper function que lê capability flags do profile em runtime
CREATE OR REPLACE FUNCTION public.has_agenda_capability(_user_id uuid, _capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _capability
    WHEN 'manage' THEN COALESCE((SELECT can_manage_agenda FROM profiles WHERE id = _user_id), false)
    WHEN 'cancel' THEN COALESCE((SELECT can_cancel_meeting FROM profiles WHERE id = _user_id), false)
    WHEN 'link_contract' THEN COALESCE((SELECT can_link_contract FROM profiles WHERE id = _user_id), false)
    ELSE false
  END;
$$;

-- 2. meeting_slot_attendees UPDATE
DROP POLICY IF EXISTS "Users can update attendees they booked or have elevated roles"
  ON public.meeting_slot_attendees;
CREATE POLICY "Users can update attendees they booked or have elevated roles"
  ON public.meeting_slot_attendees FOR UPDATE
  USING (
    booked_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'closer'::app_role)
    OR public.has_agenda_capability(auth.uid(), 'manage')
  );

-- 3. meeting_slot_attendees DELETE
DROP POLICY IF EXISTS "Authorized roles can delete attendees"
  ON public.meeting_slot_attendees;
CREATE POLICY "Authorized roles can delete attendees"
  ON public.meeting_slot_attendees FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR public.has_agenda_capability(auth.uid(), 'cancel')
  );

-- 4. meeting_slots UPDATE
DROP POLICY IF EXISTS "Users can update slots they booked or have elevated roles"
  ON public.meeting_slots;
CREATE POLICY "Users can update slots they booked or have elevated roles"
  ON public.meeting_slots FOR UPDATE
  USING (
    booked_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'closer'::app_role)
    OR public.has_agenda_capability(auth.uid(), 'manage')
  );

-- 5. meeting_slots DELETE
DROP POLICY IF EXISTS "Authorized roles can delete meeting slots"
  ON public.meeting_slots;
CREATE POLICY "Authorized roles can delete meeting slots"
  ON public.meeting_slots FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR public.has_agenda_capability(auth.uid(), 'cancel')
  );