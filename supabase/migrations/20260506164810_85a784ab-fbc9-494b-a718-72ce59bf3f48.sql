CREATE OR REPLACE FUNCTION public.delete_deal_cascade(p_deal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_exists boolean;
  v_is_priv boolean;
  v_slot_ids uuid[];
  v_attendee_ids uuid[];
  v_reg_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT true, owner_profile_id INTO v_exists, v_owner
  FROM public.crm_deals WHERE id = p_deal_id;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  v_is_priv := has_role(v_uid, 'admin'::app_role)
            OR has_role(v_uid, 'manager'::app_role)
            OR has_role(v_uid, 'coordenador'::app_role);

  IF NOT v_is_priv THEN
    IF v_owner IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Sem permissao para excluir este lead';
    END IF;
    IF NOT (has_role(v_uid, 'sdr'::app_role) OR has_role(v_uid, 'closer'::app_role)) THEN
      RAISE EXCEPTION 'Sem permissao para excluir leads';
    END IF;
  END IF;

  DELETE FROM public.deal_activities WHERE deal_id = p_deal_id;
  DELETE FROM public.deal_tasks WHERE deal_id = p_deal_id;
  DELETE FROM public.automation_queue WHERE deal_id = p_deal_id;
  DELETE FROM public.automation_logs WHERE deal_id = p_deal_id;

  SELECT array_agg(id) INTO v_slot_ids FROM public.meeting_slots WHERE deal_id = p_deal_id;
  IF v_slot_ids IS NOT NULL AND array_length(v_slot_ids, 1) > 0 THEN
    SELECT array_agg(id) INTO v_attendee_ids FROM public.meeting_slot_attendees WHERE meeting_slot_id = ANY(v_slot_ids);
    IF v_attendee_ids IS NOT NULL AND array_length(v_attendee_ids, 1) > 0 THEN
      DELETE FROM public.attendee_notes WHERE attendee_id = ANY(v_attendee_ids);
      DELETE FROM public.attendee_movement_logs WHERE attendee_id = ANY(v_attendee_ids);
      DELETE FROM public.meeting_slot_attendees WHERE id = ANY(v_attendee_ids);
    END IF;
    DELETE FROM public.meeting_slots WHERE id = ANY(v_slot_ids);
  END IF;

  DELETE FROM public.calls WHERE deal_id = p_deal_id;

  SELECT array_agg(id) INTO v_reg_ids FROM public.consorcio_pending_registrations WHERE deal_id = p_deal_id;
  IF v_reg_ids IS NOT NULL AND array_length(v_reg_ids, 1) > 0 THEN
    DELETE FROM public.consortium_documents WHERE pending_registration_id = ANY(v_reg_ids);
    DELETE FROM public.consorcio_pending_registrations WHERE id = ANY(v_reg_ids);
  END IF;

  DELETE FROM public.crm_deals WHERE id = p_deal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_deal_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_deal_cascade(uuid) TO authenticated;