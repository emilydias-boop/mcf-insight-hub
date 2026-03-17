-- Fix: Update attendees stuck as 'no_show' in rescheduled slots
UPDATE meeting_slot_attendees msa
SET status = 'rescheduled'
FROM meeting_slots ms
WHERE msa.meeting_slot_id = ms.id
  AND ms.status = 'rescheduled'
  AND msa.status = 'no_show';