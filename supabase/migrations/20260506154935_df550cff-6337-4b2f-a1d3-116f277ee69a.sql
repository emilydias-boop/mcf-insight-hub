DO $$
DECLARE
  v_new_slot_id uuid;
  v_new_att_id uuid;
BEGIN
  INSERT INTO public.meeting_slots (
    closer_id, deal_id, contact_id, scheduled_at, duration_minutes,
    status, meeting_type, source, notes
  ) VALUES (
    '0d4a5264-258f-4ba4-bef1-afea307eed2b',
    'b02b91c7-3dd4-4f9a-9662-a9500f74fb65',
    'ae663d8a-f6c4-4410-973a-5107ca2d739a',
    '2026-05-06 06:06:08+00',
    60,
    'completed',
    'r1',
    'manual',
    'Reconciliação manual — venda Hubla via link pessoal WF (Contrato CLS - WF Caução 497).'
  )
  RETURNING id INTO v_new_slot_id;

  INSERT INTO public.meeting_slot_attendees (
    meeting_slot_id, contact_id, deal_id, status, attendee_name, attendee_phone,
    is_partner, contract_paid_at, is_decision_maker, notes
  ) VALUES (
    v_new_slot_id,
    'ae663d8a-f6c4-4410-973a-5107ca2d739a',
    'b02b91c7-3dd4-4f9a-9662-a9500f74fb65',
    'contract_paid',
    'Josias Rabelo Junior',
    '+5519994396152',
    false,
    '2026-05-06 06:06:08.794+00',
    true,
    'Reconciliação manual — venda via link pessoal WF.'
  )
  RETURNING id INTO v_new_att_id;

  UPDATE public.hubla_transactions
  SET linked_attendee_id = v_new_att_id,
      linked_method = 'manual',
      linked_at = now(),
      updated_at = now()
  WHERE id = 'e54c677c-cfa6-4a22-ad44-e3b455fcfd9c';

  DELETE FROM public.meeting_slot_attendees
  WHERE id = '4c77deba-0312-438d-9eb8-468184450980';

  DELETE FROM public.meeting_slots
  WHERE id = 'c8e3f9f6-88c5-4a97-a427-dcbe167edbc0';

  RAISE NOTICE 'New slot: %, New attendee: %', v_new_slot_id, v_new_att_id;
END $$;