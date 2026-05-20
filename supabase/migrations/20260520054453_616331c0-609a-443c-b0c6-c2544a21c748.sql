WITH new_slot AS (
  INSERT INTO public.meeting_slots
    (scheduled_at, status, closer_id, meeting_type, duration_minutes, deal_id, booked_by, source)
  VALUES
    ('2026-05-21 12:00:00+00', 'scheduled', '0d4a5264-258f-4ba4-bef1-afea307eed2b', 'r1', 60,
     '2bad3125-a58a-41a7-ad15-a09d292539c6', '7aa935e2-73e1-4624-b189-aa9784e29485', 'manual_test')
  RETURNING id
)
INSERT INTO public.meeting_slot_attendees
  (meeting_slot_id, deal_id, contact_id, status, booked_by, booked_at, attendee_name, attendee_phone)
SELECT id, '2bad3125-a58a-41a7-ad15-a09d292539c6', '0f338c31-1aa2-47a2-acde-7da1ae08a630',
       'invited', '7aa935e2-73e1-4624-b189-aa9784e29485', now(),
       'ANTONIO MATHEUS RODRIGUES MARTINS', '21967385623'
FROM new_slot;

UPDATE public.crm_deals
SET stage_id='a8365215-fd31-4bdc-bbe7-77100fa39e53', stage_moved_at=now(), last_worked_at=now()
WHERE id='2bad3125-a58a-41a7-ad15-a09d292539c6';