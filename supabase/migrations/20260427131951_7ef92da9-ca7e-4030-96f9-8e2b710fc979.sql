-- Corrigir registro do Eduardo Leandro: status incorreto após transferência para Jessica Martins
UPDATE public.meeting_slot_attendees
SET 
  status = 'scheduled',
  is_reschedule = true,
  updated_at = now()
WHERE id = '9249f98a-92c4-4dd2-8ac2-62afd244a6a9'
  AND status = 'no_show';