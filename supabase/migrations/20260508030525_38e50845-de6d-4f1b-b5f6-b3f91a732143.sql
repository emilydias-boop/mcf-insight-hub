
SET session_replication_role = replica;

UPDATE hubla_transactions
SET linked_attendee_id = '41619faa-4cec-4aac-b934-2447a8fa398c',
    linked_method = 'manual',
    linked_at = now()
WHERE id = '60004b22-a686-44c8-bc51-a8de43d1ea9d';

UPDATE meeting_slot_attendees
SET status = 'contract_paid',
    contract_paid_at = '2026-04-25 19:04:11.279+00'
WHERE id = '41619faa-4cec-4aac-b934-2447a8fa398c';

UPDATE crm_deals
SET stage_id = '062927f5-b7a3-496a-9d47-eb03b3d69b10',
    stage_moved_at = now()
WHERE id = '773b2e2c-6dc4-4a57-bc38-f478c8039390';

UPDATE meeting_slot_attendees
SET status = 'contract_paid',
    contract_paid_at = '2024-01-01 12:00:00+00'
WHERE id IN (
  'b23529bc-9360-4982-86bc-2ab488153bbc',
  'f084e422-ec83-4c92-8eee-32b14f1d61f2',
  'b967f678-3c0f-4431-8771-fbca72e8d459',
  '32fb2c6b-e942-43f9-8221-881085cb4ec7',
  '5e471746-7272-42ee-ac0b-bffeff0def67',
  'ebc92763-908e-44c6-b590-73284be3d11b',
  '69db7b72-e464-47b4-9c2f-1598f4c96e75',
  '6677878a-3dee-4909-acd4-090e622cb6b1'
);

UPDATE crm_deals
SET stage_id = '062927f5-b7a3-496a-9d47-eb03b3d69b10',
    stage_moved_at = now()
WHERE id IN (
  '6c71148e-6457-46bc-97d8-3f6d4883d229',
  '6c62d6cd-1975-4139-a386-39d60ae53906',
  '31aedb86-dc9b-4d86-a1f2-c6e8996a7ead',
  'd9827cae-a386-4d27-a114-43b8f398c5c7',
  '5ce3eb15-b34c-4ceb-87a5-d4c91e1564fb',
  '724d9aae-975e-4de0-8289-ef6cb35879ef',
  '3eafd87f-665d-43c5-8f45-ccabdaa2ddce',
  '34772584-80f4-4d03-90f6-1d5c1fdc8ca1'
);

SET session_replication_role = origin;
