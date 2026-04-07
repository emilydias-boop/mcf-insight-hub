
DO $$
DECLARE
  _uids uuid[] := ARRAY[
    '00a91b9d-e160-4911-a5d5-771bbf9bf8f6','07102da2-091c-4790-bb4e-9636d7caaf22',
    '07810b83-54f9-4350-a1aa-9523822de680','0a54e673-9eb0-4b70-9e2f-4f3c2bce2061',
    '0abd75e3-0778-453f-8233-a37e343cc0d3','0e214b69-5482-4bad-8910-b096a454f131',
    '0e298025-e830-46a5-ab6d-f70506941bda','0e4565a1-e5cc-47d9-878f-1c024884d183',
    '0f2a64cd-0c31-4e7a-ae36-4a3df22ae81d','113513d0-d1c3-4fec-ab42-a8851a0d7838',
    '12587ced-a409-49a0-839b-edd089c51b55','189f0623-0452-46fc-a48d-0c9a44d26a15',
    '1b4710b4-77b8-476c-acb1-0f256a80a0ab','29909f03-5a65-426f-b50d-73ac0520cde5',
    '29c5b395-1a83-4452-99e4-dc4e00a0ba71','2e4ad587-4736-4158-be84-f439464665fa',
    '338040b2-7f83-4859-af25-cbb7ad27ad09','36c9d005-8190-48f3-97a8-feba3733a573',
    '36d9a3d9-f31c-49d2-922a-c225bb3ed42b','468bcfab-6a0a-4b0d-80ab-53e53cca2a47',
    '46af4262-ef0b-4a0b-8f24-86e50f8d25b4','57f2a740-a37c-4dcf-bea1-66826c5279ec',
    '5979442d-a405-45b1-8b85-3a138c8cb235','5cccf6d2-8d9c-40d7-8f17-1553453f9bba',
    '60ae0c58-6f1c-4bba-b240-ffade73b4c3a','694714bd-a83e-4878-ba7d-73fa5c37934d',
    '6a3148c1-0719-4c1f-9543-dcc8c6bb5b20','6bb32d25-ced8-4122-bb8c-522980aacadf',
    '7777f7e6-3071-425b-8215-aee2af197dec','78d4b363-d75e-4a79-b2cf-fcf949f5da35',
    '7ca2a655-1763-4323-a904-f586a295cd51','800bee2a-1731-4c45-a8c5-c3c58a685cb3',
    '83145f72-fd44-4980-b4c5-6a7ea193addd','89479563-1832-48ed-81bb-2a1ffb1c26ce',
    '8bce964b-0bc3-4237-82a4-68e6a73c0e16','90cb4d6f-e946-4317-a9cd-99c0340862a1',
    '93344771-de15-47a7-914a-3ffc5690596d','9959eb07-f0fb-48d1-a861-67f72182d23c',
    '99b94bf4-2394-4e56-905c-84826250475c','9dadc3d6-6c5b-471b-9244-62470d09f2d6',
    '9e903d91-e318-44b3-90bb-8173422ac847','9f92fb95-c6d0-4dee-b9f8-49cb55bd4512',
    'a294396f-3014-4704-8d83-8f5d305ce674','b007e0a4-2eff-4dd8-8b4b-f6691e757acc',
    'b33d8985-d422-4084-8b56-887d40f395a2','b8a519bb-4e7a-4ed0-8154-e57f670f5b6d',
    'b8df5741-5545-4849-aa71-492d64977b86','c1b6f150-3080-4d6f-92dc-8f7c668568d3',
    'c668c478-924d-4f0c-af1e-0a9ee89ec3fa','c76b66d3-f23a-49b5-82e6-ba29f952d1d4',
    'cd98ce01-f291-4dc6-b5bf-dced1ee8ecdb','d1553c6a-0e8b-4c71-8757-663500615229',
    'd18706d9-23a9-4f87-b507-4fb4c0b55515','d19ed2fe-4ca6-41f9-b13e-c7d42a26f7da',
    'd4da09d7-42b5-4c34-8189-db9e86031244','e2479b9e-29d5-4fff-8feb-e7db4f48ea19',
    'f51ced1d-6e08-430c-9c12-e67774ab0841','fd411c29-b4ed-41ff-b933-7edda88e188a'
  ];

  _cids uuid[] := ARRAY[
    '6d52b73a-9d6e-4efc-a027-293f72e7502f','b19500c0-ca5c-4dc8-ba94-d3018a4b7f02',
    '7341ab64-ce97-424e-b3ba-ca8a0f83a88d','da3caef8-8776-4698-98f9-bf1392e4e28c',
    '10856d0e-00dd-403e-a1ef-861b5b46649b','1e950e90-1958-48ad-b220-879b40d25712',
    '5c4bf5db-571d-476c-b14b-525b430138e9','35850f24-83ea-43fa-a61a-23f16f6740e9',
    'eb782011-6c9d-4de3-9083-bef2a1c97dbd','ce65b4e4-6470-4023-86c4-c93241880362',
    '7ac46baf-2361-4bd9-9214-1092d4c59fce','e4fe5983-1beb-4bcf-82d4-cb6b1887cb6d',
    '4cb6bcb7-f46a-4eba-b36c-acb5c5a68721','b42b871a-eb51-43d9-b5b2-e98b2f0dff90',
    'fe572ac4-cb46-4827-b03b-bc19d7eaad5d','f5d598bc-f895-4924-8e04-41d79f3b2451',
    '8992626f-a72c-4761-8611-559d5ef136a3','25b16f3a-26c0-4ddf-b0c2-9c357a758696',
    '707809b7-ca86-4707-86fc-53d8c977c9f6','d8e7f92a-f878-47d9-a53f-d48d64a31e69',
    'a079d401-2596-44d2-947a-3ab08de3622c','cc2e04e5-4ea7-4cdf-8419-d58dc562bb9d',
    'fd7f1ca1-2671-468e-88ce-7fbd9478a565','69b9b3e5-2a0e-4bce-90d8-f73405367f10',
    'c67039eb-5121-4add-939a-92ea8bed630c','fa51b419-8585-4e77-8a50-a2887c8178bf',
    '68ed9781-0426-470f-b8c9-6dc36376ae33','40e39eee-5c9a-40fc-bef2-a6deea7ff778',
    'c39a5701-331c-41f2-886c-e8ff615afd94','cb682266-fb63-4852-be78-d09c6a8e4a1b',
    'c3a797d3-28a8-4f77-8aff-b2d1a9d84707','09a4d662-3fd5-49da-b3bc-36f202fc4a23',
    '239b6a53-19a6-4e81-b59b-bddad0447eba','3f55ea70-688e-4a4e-a2f0-d2a0fcb12e4d',
    '84023a94-6bf6-41d2-a7e4-8788eeaa895f','c58041b0-d50e-48ae-bb5a-81548ab59666',
    '7eb5c33a-d9d4-436e-a666-de550414df2d','0cc4af3f-3fd5-4bde-9556-524da04b5128',
    '244db142-6814-4263-a85c-2fc95bf45c25','88e8440c-8d7f-4ee9-9c50-15cc508b8c02',
    'cc53046e-e321-435e-9fde-693834115842','c184d464-69b0-4914-884a-fef86153af66',
    'b06c1d5b-be2f-448c-bbf2-b3dfaadeebe0','7614aaef-fe2a-46ac-bceb-600a576b8feb',
    'd47b0039-7753-4d64-8216-d12c740de47d','9deb8128-a055-497e-a81c-e336486fa3a5',
    '2dbdbd66-f3fc-4110-b058-d9c89fe9b3d1','ed3bba2f-6c51-4cf6-ae80-a92d6924bbf7',
    '35239e8d-3aa9-4a77-a6ea-775eafeac144','f05f9fcf-029a-40ad-96f4-d65aaf7b16ed',
    '977b3c2f-7a8d-4edb-82de-45c7613ceeee','361e6e7a-b46f-4115-9341-e4c2bee5a64d',
    '64e84572-5511-4635-8c91-478c12a2c95a','08969b0d-5c49-4c75-ad36-6cd21ad6badd',
    'd093fbff-21b1-4044-a1df-6e2218863d9f','283322cd-8f47-44ae-b971-dfe091e43b4d',
    '4d7c8216-2ba2-48f7-9966-1a410561fa43','545f0726-584c-49b0-a2bd-b9f5d220665c'
  ];

  _tids text[];
  _slot_ids uuid[];
  _att_ids uuid[];
  _reg_ids uuid[];
BEGIN
  -- Cast deal IDs to text for deal_activities (text column)
  SELECT array_agg(x::text) INTO _tids FROM unnest(_uids) x;

  -- 1. Deal activities (deal_id is text)
  DELETE FROM deal_activities WHERE deal_id = ANY(_tids);

  -- 2. Deal tasks
  DELETE FROM deal_tasks WHERE deal_id = ANY(_uids);

  -- 3. Automation queue
  DELETE FROM automation_queue WHERE deal_id = ANY(_uids);

  -- 4. Automation logs
  DELETE FROM automation_logs WHERE deal_id = ANY(_uids);

  -- 5. Calls
  DELETE FROM calls WHERE deal_id = ANY(_uids);

  -- 6. Meeting slots and children
  SELECT array_agg(id) INTO _slot_ids FROM meeting_slots WHERE deal_id = ANY(_uids);
  IF _slot_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO _att_ids FROM meeting_slot_attendees WHERE meeting_slot_id = ANY(_slot_ids);
    IF _att_ids IS NOT NULL THEN
      DELETE FROM attendee_notes WHERE attendee_id = ANY(_att_ids);
      DELETE FROM attendee_movement_logs WHERE attendee_id = ANY(_att_ids);
      DELETE FROM meeting_slot_attendees WHERE id = ANY(_att_ids);
    END IF;
    DELETE FROM meeting_slots WHERE id = ANY(_slot_ids);
  END IF;

  -- 7. Consorcio pending registrations and documents
  SELECT array_agg(id) INTO _reg_ids FROM consorcio_pending_registrations WHERE deal_id = ANY(_uids);
  IF _reg_ids IS NOT NULL THEN
    DELETE FROM consortium_documents WHERE pending_registration_id = ANY(_reg_ids);
    DELETE FROM consorcio_pending_registrations WHERE id = ANY(_reg_ids);
  END IF;

  -- 8. Billing subscriptions (set deal_id to null instead of deleting)
  UPDATE billing_subscriptions SET deal_id = NULL WHERE deal_id = ANY(_uids);

  -- 9. Delete the 58 duplicate deals
  DELETE FROM crm_deals WHERE id = ANY(_uids);

  -- 10. Archive orphan contacts (contacts that no longer have any deals)
  UPDATE crm_contacts SET is_archived = true
  WHERE id = ANY(_cids)
    AND NOT EXISTS (SELECT 1 FROM crm_deals d WHERE d.contact_id = crm_contacts.id);

  RAISE NOTICE 'Deleted 58 duplicate recuperado-a010 deals and archived orphan contacts';
END $$;
