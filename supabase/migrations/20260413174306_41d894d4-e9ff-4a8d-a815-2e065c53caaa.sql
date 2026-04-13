-- Vincular nova transação ao attendee
UPDATE hubla_transactions 
SET linked_attendee_id = '9cf5a424-e7e3-4a96-bf16-7303f3275dc0'
WHERE id = 'fcb8b0a5-88fc-4157-9469-caeaed553b88';

-- Atualizar contract_paid_at para a data da nova venda
UPDATE meeting_slot_attendees
SET contract_paid_at = '2026-04-13 16:46:47.192+00'
WHERE id = '9cf5a424-e7e3-4a96-bf16-7303f3275dc0';