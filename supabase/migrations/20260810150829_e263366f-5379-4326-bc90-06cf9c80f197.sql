-- 1) Repontar todas as reuniões de 31/07/2026 em diante para o registro de consórcio
UPDATE public.meeting_slots
SET closer_id = '4e3eabf5-149f-4130-ad8b-72fa929671f6'
WHERE closer_id = '75934331-2e07-4006-a7c0-c916ef57486d'
  AND scheduled_at >= '2026-07-31';

-- 2) Copiar para o consórcio o único horário de grade que existia apenas no incorporador (dow=5, 17:30)
INSERT INTO public.closer_meeting_links (closer_id, day_of_week, start_time, google_meet_link, max_leads)
SELECT '4e3eabf5-149f-4130-ad8b-72fa929671f6', b.day_of_week, b.start_time, b.google_meet_link, b.max_leads
FROM public.closer_meeting_links b
WHERE b.closer_id = '75934331-2e07-4006-a7c0-c916ef57486d'
  AND NOT EXISTS (
    SELECT 1 FROM public.closer_meeting_links a
    WHERE a.closer_id = '4e3eabf5-149f-4130-ad8b-72fa929671f6'
      AND a.day_of_week = b.day_of_week
      AND a.start_time = b.start_time
  );

-- 3) Remover a grade duplicada do registro incorporador (sem uso daqui pra frente)
DELETE FROM public.closer_meeting_links
WHERE closer_id = '75934331-2e07-4006-a7c0-c916ef57486d';