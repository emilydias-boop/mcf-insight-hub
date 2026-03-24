-- Vincular transação do Samuel ao attendee R1
UPDATE hubla_transactions 
SET linked_attendee_id = '12c20077-e8a8-40b7-877d-43c3f8d50ac2'
WHERE id = '151f6791-ed3d-496f-95e0-2b7888bab08a';

-- Marcar Samuel como contract_paid com sale_date real
UPDATE meeting_slot_attendees 
SET status = 'contract_paid', 
    contract_paid_at = '2026-03-23 03:15:55.419+00'
WHERE id = '12c20077-e8a8-40b7-877d-43c3f8d50ac2';

-- Mover deal do Samuel para stage "Contrato Pago" na origin correta
UPDATE crm_deals 
SET stage_id = '062927f5-b7a3-496a-9d47-eb03b3d69b10'
WHERE id = 'a625c412-4d91-496d-bad2-be00093b0899';

-- Vincular transação do Carlos ao attendee R1
UPDATE hubla_transactions 
SET linked_attendee_id = '7e124d08-6ad8-42fc-ba0d-0ab09b581f52'
WHERE id = 'dac1d325-8ece-4ee7-bed5-aa9dc984c2be';

-- Marcar Carlos como contract_paid com sale_date real
UPDATE meeting_slot_attendees 
SET status = 'contract_paid', 
    contract_paid_at = '2026-03-23 16:07:41.217+00'
WHERE id = '7e124d08-6ad8-42fc-ba0d-0ab09b581f52';

-- Mover deal do Carlos para stage mais avançado disponível (PRODUTOS FECHADOS)
UPDATE crm_deals 
SET stage_id = '2357df56-bfad-4c4c-b37b-c5f41ce08af6'
WHERE id = 'acdffb43-c185-4c53-a636-9616c1d539c6';