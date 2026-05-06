-- 1) Reverter status dos 3 attendees afetados para 'invited'
UPDATE public.meeting_slot_attendees
SET status = 'invited'
WHERE id IN (
  '4153868d-a969-4743-a899-9b8ad56b3a60', -- Diogo
  '50d1ac15-9204-4bf1-bef3-14c06b8fca16', -- Roseane
  'f9dd452b-fe49-48da-853d-0fd360df596b'  -- Edney
);

-- 2) Mover os 3 deals de volta para "Reunião 01 Agendada" (stage_order 7)
UPDATE public.crm_deals
SET stage_id = 'a8365215-fd31-4bdc-bbe7-77100fa39e53'
WHERE id IN (
  'dc3de13e-4b71-4e27-a80b-f0ad308136bf', -- Diogo
  '5ae3854d-b7df-4bf6-b25e-7abd9aed7f36', -- Roseane
  '4daf3202-3673-472a-9e9d-ef4b577c7920'  -- Edney
);

-- 3) Apagar a validação cruzada (deal Edney + attendee Diogo)
DELETE FROM public.no_show_validations
WHERE id = '3dcd4698-f0e1-4949-b8ea-6b100460b1c3';

-- 4) Limpar tentativas bloqueadas órfãs (Roseane)
DELETE FROM public.no_show_blocked_attempts
WHERE id IN (
  '68a7ca5c-47ec-4a68-bf2f-146da5e0f463',
  'adf94d41-36d2-480e-914b-7f3a22878df9'
);