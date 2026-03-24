-- Mover meeting_slot_attendees do deal antigo (Felipe Laurentino) para o novo
UPDATE meeting_slot_attendees 
SET deal_id = '82c7c340-d806-4fb9-a826-df2205373294'
WHERE deal_id = '5c213d3c-46fa-455a-b065-63cc339256e2';

-- Mover meeting_slots do deal antigo para o novo
UPDATE meeting_slots 
SET deal_id = '82c7c340-d806-4fb9-a826-df2205373294'
WHERE deal_id = '5c213d3c-46fa-455a-b065-63cc339256e2';