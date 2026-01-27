-- Correção retroativa: Marcar attendees que pagaram contrato A000 como contract_paid
UPDATE meeting_slot_attendees 
SET 
  status = 'contract_paid',
  updated_at = NOW()
WHERE id IN (
  '83f27760-40cf-416c-9236-c23b0af09401',
  '534be39a-5a8c-40a1-bb26-b0af41921a5d',
  'aa973495-92ef-4696-8dba-6654ddcc5c7d',
  'f5f586a8-03fa-45dc-b2cb-f4600cf04615',
  '5d6a5afb-734b-4943-b390-aa4e52db9a6f'
)