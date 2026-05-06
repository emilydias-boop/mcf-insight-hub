-- Marcar Ricardo Gomes Vendeth como Contrato Pago (Outside)
-- Attendee R1: ebc92763-908e-44c6-b590-73284be3d11b
-- Deal: 724d9aae-975e-4de0-8289-ef6cb35879ef
-- Origin: e3c04f21-ba2c-4c66-84f8-b4341c826b1c (Inside Sales)

UPDATE public.meeting_slot_attendees
SET status = 'contract_paid',
    contract_paid_at = '2026-04-28T18:30:00+00:00'
WHERE id = 'ebc92763-908e-44c6-b590-73284be3d11b';

UPDATE public.crm_deals
SET stage_id = (
  SELECT id FROM public.crm_stages
  WHERE origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
    AND stage_name ILIKE '%contrato%pago%'
  LIMIT 1
)
WHERE id = '724d9aae-975e-4de0-8289-ef6cb35879ef';