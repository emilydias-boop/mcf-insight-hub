
DO $$
DECLARE
  _uids uuid[] := ARRAY[
    '026ffd5b-95e1-4543-92eb-34556fe67f3f','05783c9c-f657-46f1-acb8-89838eb40c56','0c2f1821-b3ac-490e-ac79-589565676a04','0c626bd1-825a-4aae-97db-b81ec4439010','0e390e5b-d734-4c9e-bec1-92fb95944e31','0f0b9ca3-479a-4141-9bfe-a5bfdf5e963d','10d750ce-dda3-4d10-81d7-47fce4f8cfe4','12fed878-e4f7-4f7c-bb5f-c3eb767e0e2c','1539d104-ce59-4fd4-84c5-31826be2c412','1694a59b-a25f-4f04-9824-76e6cd289cc8',
    '18273747-a21e-40a2-979f-422ad289fa97','1a9a3c4c-90bd-427d-832a-7ea1df930b52','215b645f-1346-4015-87ee-ccd54d89d029','23e0bd66-eba0-48e7-b83d-1ba9de4dc8d8','26dcde90-2914-4d44-96bb-5630f3691571','29100910-0a07-44ea-a4d9-6e47cbe1db32','2eaee1b0-6d4a-41d4-97b2-46cbe9654577','2fd71841-174e-4c96-b604-6864d058affc','31a64914-97f6-47ae-9b2e-d94bca232858','32231e9a-f2b6-4001-8e55-223d08db0eae',
    '3317336a-43e6-4eb0-8159-bbd2fcde8676','333ed71f-fc1a-4dbc-b46f-a1b2870835db','39d07364-eea0-44a8-9262-c7602655befc','3ae502d8-b810-4b59-947a-560e1ca4e197','3cdf82e8-3284-4b21-a706-aeea0dc26f73','4211e8ab-233e-424d-aaa0-f3be6e4ee50c','44445968-73c6-49c1-908c-e7be01a9adf2','48824664-425a-495b-8c36-31f8dc9e7f59','4a5e89ac-9371-462c-a3a6-78ceb9ce89bc','4a83a5c8-fcbb-4242-bf8d-3433af6f3bcd',
    '4ef6498f-62d5-43b2-b1e6-423f56b28e7d','4f723cb4-f961-46fc-9482-6e6e197388a8','4f890a0d-c352-4668-9fc5-3b6d11eaf65a','529f0d4f-beca-4870-b268-08072bb4f7ad','54b2eed5-fac8-4dcf-8339-c8b723cf9076','56fe28f2-8c85-4e59-b93d-fdcd98e1083b','594399cf-d962-4a0a-87e9-80be9b6c0d94','5a47ba79-6e93-45bc-aa14-e457b220d0a0','5a9b966a-e99a-4d2b-b1b3-425f20b1e56e','5b2966ec-2cda-4a4a-803d-8a4a026d65d3',
    '5cd6ee08-8499-4d1f-ac68-6c2db007f092','5e1cb440-20e8-48d2-bf81-c6ffe2d29a3a','6089a2e2-b0dd-47a1-9cf6-2f090465c043','6139eeb3-2809-4422-a3ea-bb8ee7afacc6','6454c178-55b7-419a-add3-18cb5aff3c2a','66fdaeb0-9e0b-4507-ac5f-44fd4ee09047','68c74d3d-204c-49e7-9801-3f11eec86bbb','69f181c5-60ad-4b15-8d9b-17973bd2d53d','6aaa4e26-9f2e-480b-ae96-80141ec5f517','6ac5b8c7-be26-4ebe-a308-4706bf8cc4cf',
    '6fbd2400-8095-4fad-8465-7cc77026873f','70cac2bd-35ca-4ef5-af27-ec469e7983d9','70d8e5dd-c050-4a37-b0b5-c7aa1997390e','71c69cb7-a8d5-4a98-b036-93dcf6476d56','72cee887-e0f8-4ce5-b791-59b8e7a83369','73549178-ecab-4bce-b9a7-a5cf9560babf','759ac4cc-787e-40e1-8986-d9d8c24603c7','75b421e6-314a-41b7-835e-150570fc54e7','7900bc43-dae2-420c-8bd6-292b0cdfdc9b','79018cff-7bcc-42b6-80d1-ada74adb035e',
    '79be19c3-6b33-41a3-82b8-fb9f7e858e77','7a5ed70b-8f6b-4aaa-b826-741c118fe44d','7d99f91f-84e4-45cd-ab19-36a0cbc51fda','7e6dd3f8-120a-4e1f-b3a8-0ee1887ca22f','822b0a10-5eae-4511-afae-91afd81ed80a','84fa4665-288b-484f-81c8-9f18b08fd0b8','8530a76a-2554-43fc-bbb7-782b38527b67','8701fbe5-d4a0-4f84-8479-ab8006183790','875c8df4-3d2b-4c98-a8a6-493557a16427','878aee9a-6e13-439c-a433-64337713c856',
    '8944988c-a572-46bc-97cf-76510c63fbbe','8d30f777-de89-4d39-9c8b-83d15dd53f8f','8d737116-835e-4e3d-b86c-4e1a4e7f4654','926631af-60c8-4c4e-bd36-bfe97e75c3f8','95a75699-3615-46b6-88bf-3d37ebcbfcc5','97df1ca6-b7bb-4a5a-9bab-8ca3be867f8f','a02494ee-0893-43e0-ad96-cfc9461d6839','a0dc2a63-275d-4d65-84a8-5f12be55424c','a4a73fd9-13b0-45c1-a099-cc9ab97b7c44','a4a88809-9402-49d6-a93c-41e830db4e80',
    'a51d6165-a169-4977-aea7-f2be688dd745','a57a2550-327c-4162-b442-1d494421bc91','a5928e4b-a1f4-498c-94aa-93c9f97d910e','a6c92e7d-e49c-41a9-b36c-93401091809b','ab451d1d-e5ea-40cf-a2c7-5ad175cd7c77','ac45f8e5-7c73-4338-824d-94159738edd7','ad16d744-287e-488d-98dd-ddff847a586a','ad50848b-110a-4140-9bb4-694ceadfca10','ae2014fa-5de7-4d47-8106-480d49b591e3','aeb195d2-8563-46e8-a252-e2ce31a12d71',
    'afab09c6-43a0-400f-95b7-6e985b063fe7','b428ad18-945a-4b85-84a1-50d351c554ae','b5604f7e-fd1f-4439-ba8d-05c3f16328b1','b620eaaf-b12e-483b-ab69-48b70294aad8','b9671610-f729-4446-9112-8204f76cffb6','bab23e54-c395-4836-916c-14d67d769dc5','be7d628f-05a9-4ffe-aaad-67ff3c07d162','bfb24e67-17c8-4519-9fba-ce664e4b1cc9','c23581b2-8920-4d0f-8b6d-ad370b48c2eb','c7871374-796a-4930-8f26-b4718e26ecd4',
    'c859c21f-bd45-49b2-b709-41d74ff1c252','cb2cc55c-ee42-43bc-b16c-73488dfadcf4','cfb39ade-347f-4542-87c5-c9ea95f57165','d2b55900-5490-4d48-ba21-86576f3cdd0a','d7d16362-3329-4e89-bd4d-b44f70b986cf','da12609f-52e4-4b60-ba80-9b07eb73822f','db279b47-11a4-4faf-b11a-d89db576134f','dc9fda3a-20fe-49cc-9d24-5d6ed0373910','ddb18fa0-22e6-43d2-a382-dc451cafa8ee','e117fcaf-8bdc-4263-9ea8-4ce7ce83ac6c',
    'e25e337b-fe02-437e-976f-481bd4ddcda1','e328e57a-6b9d-422d-b83f-016d23adef07','e3e0135b-34b9-4b75-b549-3538d579d459','e4368a11-e73e-4dc9-87d6-7ca50ee1a777','e81b02cc-c14f-4d1f-b14c-0f1b6a4051aa','e99e4291-6061-4a34-b1f0-37f22eada4f8','ea1e2e19-9df0-43e5-b777-d89de8cbe414','eea24e81-bef6-4b79-b57c-c2c0ea9fb7f4','f3113de1-acf2-4ee6-9f53-3f2475abf105','f4724a49-03c4-41c1-a109-3feb9c75c74d',
    'f9721357-dd27-475f-8a08-ddc159a0af18','fe73100e-6cda-481c-9f4d-c0783dd29b74','ffa0160a-bdee-4571-b594-a782fedfe5f9'
  ];
  _tids text[];
BEGIN
  -- Cast to text array for deal_activities (text deal_id)
  SELECT array_agg(x::text) INTO _tids FROM unnest(_uids) x;

  -- deal_activities has TEXT deal_id
  DELETE FROM deal_activities WHERE deal_id = ANY(_tids);
  
  -- All other tables have UUID deal_id
  DELETE FROM deal_tasks WHERE deal_id = ANY(_uids);
  DELETE FROM automation_queue WHERE deal_id = ANY(_uids);
  DELETE FROM automation_logs WHERE deal_id = ANY(_uids);
  DELETE FROM calls WHERE deal_id = ANY(_uids);

  -- Meeting slots e filhos
  DELETE FROM attendee_notes WHERE attendee_id IN (
    SELECT msa.id FROM meeting_slot_attendees msa
    JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    WHERE ms.deal_id = ANY(_uids)
  );
  DELETE FROM attendee_movement_logs WHERE attendee_id IN (
    SELECT msa.id FROM meeting_slot_attendees msa
    JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    WHERE ms.deal_id = ANY(_uids)
  );
  DELETE FROM meeting_slot_attendees WHERE meeting_slot_id IN (
    SELECT id FROM meeting_slots WHERE deal_id = ANY(_uids)
  );
  DELETE FROM meeting_slots WHERE deal_id = ANY(_uids);

  -- Consórcio pending registrations
  DELETE FROM consortium_documents WHERE pending_registration_id IN (
    SELECT id FROM consorcio_pending_registrations WHERE deal_id = ANY(_uids)
  );
  DELETE FROM consorcio_pending_registrations WHERE deal_id = ANY(_uids);

  -- Billing subscriptions
  DELETE FROM billing_subscriptions WHERE deal_id = ANY(_uids);

  -- Deletar os 123 deals
  DELETE FROM crm_deals WHERE id = ANY(_uids);
END $$;
