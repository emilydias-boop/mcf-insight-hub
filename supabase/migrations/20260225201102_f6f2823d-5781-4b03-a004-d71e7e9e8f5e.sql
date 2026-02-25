
-- 1. Link orphan contract to correct attendee
UPDATE hubla_transactions 
SET linked_attendee_id = '3a8e3764-bc29-42f0-8aee-735e88829f40'
WHERE id = '95442e91-88c9-4219-9af7-16a450e39717';

-- 2. Cancel R1 attendee of deal #3
UPDATE meeting_slot_attendees 
SET status = 'cancelled' 
WHERE id = '5e21508a-0b67-4284-8191-061c6f585ccb';

-- 3. Cancel the meeting slot of deal #3
UPDATE meeting_slots 
SET status = 'cancelled' 
WHERE id = '4afc077a-4189-4e60-8e04-262aee3c9ba3';

-- 4. Move deal #3 to "Sem Interesse"
UPDATE crm_deals 
SET stage_id = 'b06c9413-0312-4f1d-89b4-822d79bc6a90'
WHERE id = '99610ea6-19fa-4b22-b8a8-b7cbfd4b3e5e';

-- 5. Delete orphan contacts (no deals attached)
DELETE FROM crm_contacts 
WHERE id IN (
  '6d5f26e5-f057-47b3-a3eb-f6f2ad502b7e',
  'ac041faa-5262-4bd9-8000-c8bba3fa0f01',
  'a0575358-ae4b-46d5-8697-0e257ffab007',
  'dc422f2b-2ede-44f6-b91c-36d0241a32da',
  '3fa43dbb-2258-4d93-8955-376a0c62c2f7'
);
