-- Reverter 3 sócios incorretamente marcados como contract_paid
UPDATE meeting_slot_attendees 
SET status = 'scheduled', contract_paid_at = NULL 
WHERE id IN (
  'ab791ce3-e728-4138-acd4-886eae1d3060',
  '65ed77d1-33ad-4342-9b97-8f32204d9104',
  '968ee07c-bc80-4099-adf6-fc69c44d7877'
)
AND is_partner = true;