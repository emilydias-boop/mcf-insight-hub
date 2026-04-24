-- Cleanup: revert duplicate contract_paid attendee for Sérgio Lowczy (16/04)
-- Keeps only the most recent attendee (24/04) as contract_paid
UPDATE public.meeting_slot_attendees
SET status = 'no_show',
    contract_paid_at = NULL
WHERE id = '057bee5d-e0b7-482e-be30-295c5254fcd7'
  AND deal_id = 'f9b6598c-aee5-4a62-a33f-95e470c8e9cf'
  AND status = 'contract_paid';