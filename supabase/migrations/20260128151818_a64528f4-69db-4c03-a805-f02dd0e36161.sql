-- Corrigir R1s para contract_paid (Steeve e Christino com Julio)
UPDATE meeting_slot_attendees 
SET status = 'contract_paid', updated_at = NOW()
WHERE id IN ('32c5cdd8-5174-482d-a416-436dc44e0207', 'b4847fcb-f0d6-4216-a11c-e5be915eea1f');

-- Reverter R2s para invited (já que contrato foi fechado na R1)
UPDATE meeting_slot_attendees 
SET status = 'invited', updated_at = NOW()
WHERE id IN ('a6d74d87-5d0f-4694-bb9a-707e9983cd66', '8ff19f47-eca8-44be-a612-dfc0f02e8195');