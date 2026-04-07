
-- Step 1: Clean dependent records for the 38 backfill deals to delete
DELETE FROM deal_activities WHERE deal_id IN (
  'c1d8d974-6ecb-4486-adcb-159d523c3beb','121c1bf3-83f3-4d7f-9005-65e8a2e5d1f7',
  'd3a08f30-316d-4ff1-897d-fce937b2efca','1687d591-e9fa-4f0e-9de2-1d3930ab4048',
  'c542fe5a-02c2-4e69-9713-aad1284e6138','317b16a2-d699-4e48-9017-ac8a485e4594',
  '488639b3-f6fe-4754-8801-70d34e9c00d9','ee241b5b-8e07-4cc3-86ec-0b43253c9bc7',
  '259bbb39-cb7c-4209-a73f-8ef065a12486','1f97d58e-bc0e-43dd-90b7-4fa1d87e81e0',
  '8b37614c-c8d9-4739-a026-a6fd9a64f39a','5a3a0b15-bca9-4199-a0ab-79702fd32cd4',
  '3e862612-17a9-4735-bb3e-1e4d20d9a479','9e0a4ff7-3e2e-4938-8abb-13aabe37384f',
  '3045571d-3955-4568-8974-f836624255b8','2c40b521-071e-4e4f-bf23-59797331ded6',
  'd24d4ab7-c675-43c7-927a-9c0411eefa8d','130b290e-3930-41ba-b7dc-3686b892be9b',
  '05bb69aa-d1b3-44e3-8182-b94a25e9ebcd','ed1a259d-5388-4720-b2cf-ec46c5392da3',
  'dbfd50da-5dd0-4d9f-9f58-7ee18a56ef8c','cd0a2152-83a7-4f27-8412-ca780b2f5f62',
  'c4095dca-7dbd-46fc-963e-77bd4b6aae82','08f8ed68-f06e-4666-8373-89300fe8dda9',
  '85e1542b-7860-419a-a150-6da55f0f627f','4dcc4a90-53be-475d-8cc8-ff4e51bd7bde',
  '39069d00-2885-4f56-9004-f10259aea206','ba13596b-c0b9-4c15-8c37-988e2e92bbad',
  '162ac2de-e515-40e3-9cee-5b0a0a4fe168','9e8aabff-70dc-4cb9-90e1-dc04f2852e5c',
  'a98762a9-2f32-4eb3-9739-46bb8cb6f476','7508babb-8cfc-4829-b42d-05e561a7cfc8',
  'a95cd08c-6fa2-4a94-a053-b8dbe0347b4a','3f0e2ab2-64a5-4a07-a826-23671756b10d',
  '403805bb-899b-4f9a-9c09-af1e3040a2b9','b94ca50a-8b88-43c2-b7e4-ebdbaa7c4f85',
  '90cf097e-d5b0-4866-b0a5-3898764799f8','61805524-4235-4b9e-bc5f-632a0e1a45a5'
);

DELETE FROM deal_tasks WHERE deal_id IN (
  'c1d8d974-6ecb-4486-adcb-159d523c3beb','121c1bf3-83f3-4d7f-9005-65e8a2e5d1f7',
  'd3a08f30-316d-4ff1-897d-fce937b2efca','1687d591-e9fa-4f0e-9de2-1d3930ab4048',
  'c542fe5a-02c2-4e69-9713-aad1284e6138','317b16a2-d699-4e48-9017-ac8a485e4594',
  '488639b3-f6fe-4754-8801-70d34e9c00d9','ee241b5b-8e07-4cc3-86ec-0b43253c9bc7',
  '259bbb39-cb7c-4209-a73f-8ef065a12486','1f97d58e-bc0e-43dd-90b7-4fa1d87e81e0',
  '8b37614c-c8d9-4739-a026-a6fd9a64f39a','5a3a0b15-bca9-4199-a0ab-79702fd32cd4',
  '3e862612-17a9-4735-bb3e-1e4d20d9a479','9e0a4ff7-3e2e-4938-8abb-13aabe37384f',
  '3045571d-3955-4568-8974-f836624255b8','2c40b521-071e-4e4f-bf23-59797331ded6',
  'd24d4ab7-c675-43c7-927a-9c0411eefa8d','130b290e-3930-41ba-b7dc-3686b892be9b',
  '05bb69aa-d1b3-44e3-8182-b94a25e9ebcd','ed1a259d-5388-4720-b2cf-ec46c5392da3',
  'dbfd50da-5dd0-4d9f-9f58-7ee18a56ef8c','cd0a2152-83a7-4f27-8412-ca780b2f5f62',
  'c4095dca-7dbd-46fc-963e-77bd4b6aae82','08f8ed68-f06e-4666-8373-89300fe8dda9',
  '85e1542b-7860-419a-a150-6da55f0f627f','4dcc4a90-53be-475d-8cc8-ff4e51bd7bde',
  '39069d00-2885-4f56-9004-f10259aea206','ba13596b-c0b9-4c15-8c37-988e2e92bbad',
  '162ac2de-e515-40e3-9cee-5b0a0a4fe168','9e8aabff-70dc-4cb9-90e1-dc04f2852e5c',
  'a98762a9-2f32-4eb3-9739-46bb8cb6f476','7508babb-8cfc-4829-b42d-05e561a7cfc8',
  'a95cd08c-6fa2-4a94-a053-b8dbe0347b4a','3f0e2ab2-64a5-4a07-a826-23671756b10d',
  '403805bb-899b-4f9a-9c09-af1e3040a2b9','b94ca50a-8b88-43c2-b7e4-ebdbaa7c4f85',
  '90cf097e-d5b0-4866-b0a5-3898764799f8','61805524-4235-4b9e-bc5f-632a0e1a45a5'
);

DELETE FROM automation_queue WHERE deal_id IN (
  'c1d8d974-6ecb-4486-adcb-159d523c3beb','121c1bf3-83f3-4d7f-9005-65e8a2e5d1f7',
  'd3a08f30-316d-4ff1-897d-fce937b2efca','1687d591-e9fa-4f0e-9de2-1d3930ab4048',
  'c542fe5a-02c2-4e69-9713-aad1284e6138','317b16a2-d699-4e48-9017-ac8a485e4594',
  '488639b3-f6fe-4754-8801-70d34e9c00d9','ee241b5b-8e07-4cc3-86ec-0b43253c9bc7',
  '259bbb39-cb7c-4209-a73f-8ef065a12486','1f97d58e-bc0e-43dd-90b7-4fa1d87e81e0',
  '8b37614c-c8d9-4739-a026-a6fd9a64f39a','5a3a0b15-bca9-4199-a0ab-79702fd32cd4',
  '3e862612-17a9-4735-bb3e-1e4d20d9a479','9e0a4ff7-3e2e-4938-8abb-13aabe37384f',
  '3045571d-3955-4568-8974-f836624255b8','2c40b521-071e-4e4f-bf23-59797331ded6',
  'd24d4ab7-c675-43c7-927a-9c0411eefa8d','130b290e-3930-41ba-b7dc-3686b892be9b',
  '05bb69aa-d1b3-44e3-8182-b94a25e9ebcd','ed1a259d-5388-4720-b2cf-ec46c5392da3',
  'dbfd50da-5dd0-4d9f-9f58-7ee18a56ef8c','cd0a2152-83a7-4f27-8412-ca780b2f5f62',
  'c4095dca-7dbd-46fc-963e-77bd4b6aae82','08f8ed68-f06e-4666-8373-89300fe8dda9',
  '85e1542b-7860-419a-a150-6da55f0f627f','4dcc4a90-53be-475d-8cc8-ff4e51bd7bde',
  '39069d00-2885-4f56-9004-f10259aea206','ba13596b-c0b9-4c15-8c37-988e2e92bbad',
  '162ac2de-e515-40e3-9cee-5b0a0a4fe168','9e8aabff-70dc-4cb9-90e1-dc04f2852e5c',
  'a98762a9-2f32-4eb3-9739-46bb8cb6f476','7508babb-8cfc-4829-b42d-05e561a7cfc8',
  'a95cd08c-6fa2-4a94-a053-b8dbe0347b4a','3f0e2ab2-64a5-4a07-a826-23671756b10d',
  '403805bb-899b-4f9a-9c09-af1e3040a2b9','b94ca50a-8b88-43c2-b7e4-ebdbaa7c4f85',
  '90cf097e-d5b0-4866-b0a5-3898764799f8','61805524-4235-4b9e-bc5f-632a0e1a45a5'
);

DELETE FROM automation_logs WHERE deal_id IN (
  'c1d8d974-6ecb-4486-adcb-159d523c3beb','121c1bf3-83f3-4d7f-9005-65e8a2e5d1f7',
  'd3a08f30-316d-4ff1-897d-fce937b2efca','1687d591-e9fa-4f0e-9de2-1d3930ab4048',
  'c542fe5a-02c2-4e69-9713-aad1284e6138','317b16a2-d699-4e48-9017-ac8a485e4594',
  '488639b3-f6fe-4754-8801-70d34e9c00d9','ee241b5b-8e07-4cc3-86ec-0b43253c9bc7',
  '259bbb39-cb7c-4209-a73f-8ef065a12486','1f97d58e-bc0e-43dd-90b7-4fa1d87e81e0',
  '8b37614c-c8d9-4739-a026-a6fd9a64f39a','5a3a0b15-bca9-4199-a0ab-79702fd32cd4',
  '3e862612-17a9-4735-bb3e-1e4d20d9a479','9e0a4ff7-3e2e-4938-8abb-13aabe37384f',
  '3045571d-3955-4568-8974-f836624255b8','2c40b521-071e-4e4f-bf23-59797331ded6',
  'd24d4ab7-c675-43c7-927a-9c0411eefa8d','130b290e-3930-41ba-b7dc-3686b892be9b',
  '05bb69aa-d1b3-44e3-8182-b94a25e9ebcd','ed1a259d-5388-4720-b2cf-ec46c5392da3',
  'dbfd50da-5dd0-4d9f-9f58-7ee18a56ef8c','cd0a2152-83a7-4f27-8412-ca780b2f5f62',
  'c4095dca-7dbd-46fc-963e-77bd4b6aae82','08f8ed68-f06e-4666-8373-89300fe8dda9',
  '85e1542b-7860-419a-a150-6da55f0f627f','4dcc4a90-53be-475d-8cc8-ff4e51bd7bde',
  '39069d00-2885-4f56-9004-f10259aea206','ba13596b-c0b9-4c15-8c37-988e2e92bbad',
  '162ac2de-e515-40e3-9cee-5b0a0a4fe168','9e8aabff-70dc-4cb9-90e1-dc04f2852e5c',
  'a98762a9-2f32-4eb3-9739-46bb8cb6f476','7508babb-8cfc-4829-b42d-05e561a7cfc8',
  'a95cd08c-6fa2-4a94-a053-b8dbe0347b4a','3f0e2ab2-64a5-4a07-a826-23671756b10d',
  '403805bb-899b-4f9a-9c09-af1e3040a2b9','b94ca50a-8b88-43c2-b7e4-ebdbaa7c4f85',
  '90cf097e-d5b0-4866-b0a5-3898764799f8','61805524-4235-4b9e-bc5f-632a0e1a45a5'
);

DELETE FROM calls WHERE deal_id IN (
  'c1d8d974-6ecb-4486-adcb-159d523c3beb','121c1bf3-83f3-4d7f-9005-65e8a2e5d1f7',
  'd3a08f30-316d-4ff1-897d-fce937b2efca','1687d591-e9fa-4f0e-9de2-1d3930ab4048',
  'c542fe5a-02c2-4e69-9713-aad1284e6138','317b16a2-d699-4e48-9017-ac8a485e4594',
  '488639b3-f6fe-4754-8801-70d34e9c00d9','ee241b5b-8e07-4cc3-86ec-0b43253c9bc7',
  '259bbb39-cb7c-4209-a73f-8ef065a12486','1f97d58e-bc0e-43dd-90b7-4fa1d87e81e0',
  '8b37614c-c8d9-4739-a026-a6fd9a64f39a','5a3a0b15-bca9-4199-a0ab-79702fd32cd4',
  '3e862612-17a9-4735-bb3e-1e4d20d9a479','9e0a4ff7-3e2e-4938-8abb-13aabe37384f',
  '3045571d-3955-4568-8974-f836624255b8','2c40b521-071e-4e4f-bf23-59797331ded6',
  'd24d4ab7-c675-43c7-927a-9c0411eefa8d','130b290e-3930-41ba-b7dc-3686b892be9b',
  '05bb69aa-d1b3-44e3-8182-b94a25e9ebcd','ed1a259d-5388-4720-b2cf-ec46c5392da3',
  'dbfd50da-5dd0-4d9f-9f58-7ee18a56ef8c','cd0a2152-83a7-4f27-8412-ca780b2f5f62',
  'c4095dca-7dbd-46fc-963e-77bd4b6aae82','08f8ed68-f06e-4666-8373-89300fe8dda9',
  '85e1542b-7860-419a-a150-6da55f0f627f','4dcc4a90-53be-475d-8cc8-ff4e51bd7bde',
  '39069d00-2885-4f56-9004-f10259aea206','ba13596b-c0b9-4c15-8c37-988e2e92bbad',
  '162ac2de-e515-40e3-9cee-5b0a0a4fe168','9e8aabff-70dc-4cb9-90e1-dc04f2852e5c',
  'a98762a9-2f32-4eb3-9739-46bb8cb6f476','7508babb-8cfc-4829-b42d-05e561a7cfc8',
  'a95cd08c-6fa2-4a94-a053-b8dbe0347b4a','3f0e2ab2-64a5-4a07-a826-23671756b10d',
  '403805bb-899b-4f9a-9c09-af1e3040a2b9','b94ca50a-8b88-43c2-b7e4-ebdbaa7c4f85',
  '90cf097e-d5b0-4866-b0a5-3898764799f8','61805524-4235-4b9e-bc5f-632a0e1a45a5'
);

-- Step 2: Delete the 38 duplicate backfill deals
DELETE FROM crm_deals WHERE id IN (
  'c1d8d974-6ecb-4486-adcb-159d523c3beb','121c1bf3-83f3-4d7f-9005-65e8a2e5d1f7',
  'd3a08f30-316d-4ff1-897d-fce937b2efca','1687d591-e9fa-4f0e-9de2-1d3930ab4048',
  'c542fe5a-02c2-4e69-9713-aad1284e6138','317b16a2-d699-4e48-9017-ac8a485e4594',
  '488639b3-f6fe-4754-8801-70d34e9c00d9','ee241b5b-8e07-4cc3-86ec-0b43253c9bc7',
  '259bbb39-cb7c-4209-a73f-8ef065a12486','1f97d58e-bc0e-43dd-90b7-4fa1d87e81e0',
  '8b37614c-c8d9-4739-a026-a6fd9a64f39a','5a3a0b15-bca9-4199-a0ab-79702fd32cd4',
  '3e862612-17a9-4735-bb3e-1e4d20d9a479','9e0a4ff7-3e2e-4938-8abb-13aabe37384f',
  '3045571d-3955-4568-8974-f836624255b8','2c40b521-071e-4e4f-bf23-59797331ded6',
  'd24d4ab7-c675-43c7-927a-9c0411eefa8d','130b290e-3930-41ba-b7dc-3686b892be9b',
  '05bb69aa-d1b3-44e3-8182-b94a25e9ebcd','ed1a259d-5388-4720-b2cf-ec46c5392da3',
  'dbfd50da-5dd0-4d9f-9f58-7ee18a56ef8c','cd0a2152-83a7-4f27-8412-ca780b2f5f62',
  'c4095dca-7dbd-46fc-963e-77bd4b6aae82','08f8ed68-f06e-4666-8373-89300fe8dda9',
  '85e1542b-7860-419a-a150-6da55f0f627f','4dcc4a90-53be-475d-8cc8-ff4e51bd7bde',
  '39069d00-2885-4f56-9004-f10259aea206','ba13596b-c0b9-4c15-8c37-988e2e92bbad',
  '162ac2de-e515-40e3-9cee-5b0a0a4fe168','9e8aabff-70dc-4cb9-90e1-dc04f2852e5c',
  'a98762a9-2f32-4eb3-9739-46bb8cb6f476','7508babb-8cfc-4829-b42d-05e561a7cfc8',
  'a95cd08c-6fa2-4a94-a053-b8dbe0347b4a','3f0e2ab2-64a5-4a07-a826-23671756b10d',
  '403805bb-899b-4f9a-9c09-af1e3040a2b9','b94ca50a-8b88-43c2-b7e4-ebdbaa7c4f85',
  '90cf097e-d5b0-4866-b0a5-3898764799f8','61805524-4235-4b9e-bc5f-632a0e1a45a5'
);

-- Step 3: Archive the 38 duplicate backfill contacts, linking to the primary contact
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '94d52a24-ee89-4b61-8bfd-a8f8d03b55e8', merged_at = now() WHERE id = 'e0c0856b-c8a0-46c4-be9e-b25886304f94';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '5c49bdc3-ced0-46eb-a6ac-fc1877ac7b76', merged_at = now() WHERE id = '33b6ebfe-1d37-4d13-9f74-3547199bf56e';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '828353ae-bc72-49cb-a5ea-a6a5a7c9a318', merged_at = now() WHERE id = '81a2aef5-fe89-4393-b285-36c148f139f4';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '97a1e203-3d7e-40c0-94d1-f61573275dd9', merged_at = now() WHERE id = '4a4d5a30-9728-4dcf-94c8-5fc5f2f03b78';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '167df0f6-9eb8-41d3-9fe0-68fbfc899710', merged_at = now() WHERE id = '0f794edc-2a81-46c8-ba66-d1c11b9556b4';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '64826e9d-eb3b-4daf-b3fc-4dad9f978813', merged_at = now() WHERE id = 'b692b8c7-50cd-4402-aa4a-4f38859a89dc';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '11db243a-3b61-4b0f-a34a-4de6407ce1f9', merged_at = now() WHERE id = 'bd132b0f-8667-4611-9d13-cad127f9d8fd';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '0b8c778f-de47-4506-9e5e-88c0d5cd0805', merged_at = now() WHERE id = '7f058248-5f6a-41f6-84c2-8311b4b1cc32';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'b6d4114c-a9e2-4117-9fd0-def404b2a7dc', merged_at = now() WHERE id = '191f345f-3b8f-4819-b6b2-b3b12e4bb21e';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '62994f18-404c-4a32-8b62-138e067938a0', merged_at = now() WHERE id = '3ec53ef4-0640-4b30-af82-c231b120e319';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '86e9d512-8b53-4da8-a6bb-14ecc238c870', merged_at = now() WHERE id = '0b801671-e790-46b3-8ccd-8b309c492308';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'c0c1b19e-cd0a-4436-a69b-92a98e3a9eb4', merged_at = now() WHERE id = '20de3aa5-6dde-4180-8731-f081b8195259';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'fe1985ed-bb77-4c62-ba35-6efa626b9e3d', merged_at = now() WHERE id = '5b3497da-d231-4dd9-a5ca-ddae8c351943';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '7efb20c3-7a18-4116-8617-e92875a26273', merged_at = now() WHERE id = '54de742b-6777-46f6-8d26-84d06ab0d323';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '44547460-daf6-4070-a660-a8cbb436c40d', merged_at = now() WHERE id = '1f8e72c3-4e80-4c06-803f-0e88869ea2ca';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '2e669099-039a-4fb9-ae50-ddc3503ef813', merged_at = now() WHERE id = '8a7ef2a6-8b67-45a1-8306-cd5d169678e9';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '7dc54da6-a660-4d33-849a-cec11b9fce50', merged_at = now() WHERE id = 'cc5de22d-82c2-48c5-b17d-b2008a5c0330';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'b6c4a669-7686-4026-b00e-46a3a7398c49', merged_at = now() WHERE id = '217e208e-6872-41a7-91d9-cbed6209821d';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'ab46ec5f-5602-491d-a79b-ec83a12cd5cf', merged_at = now() WHERE id = 'ece4b148-989b-4671-b399-328de50e77bd';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'af3631c9-b116-4ade-9d4f-69cb2cd930f8', merged_at = now() WHERE id = '887891c4-3714-4669-a2c8-cd80d8393774';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'ebd10308-8fe0-49cd-92c6-bc617c504049', merged_at = now() WHERE id = '34716475-036b-43c5-bb68-dfc30add955f';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '99bcbb04-1147-4768-9466-17f65c2a46eb', merged_at = now() WHERE id = '4d7dcf90-0098-41c4-a63d-7c62872b70cd';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '6510c0ae-e60d-4215-8940-1eb891bd2c80', merged_at = now() WHERE id = '837b6ebf-3f67-475c-83aa-1cd072945003';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '9379f330-6506-4f77-95f7-f52d6dad9367', merged_at = now() WHERE id = '69b9b3e5-2a0e-4bce-90d8-f73405367f10';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'f509790c-6dc2-46bc-9959-79269def810b', merged_at = now() WHERE id = 'ad75b7f7-70f4-418a-b047-064083a180ef';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '4b5778c2-532d-40e1-9c7c-e77caf08991c', merged_at = now() WHERE id = 'fc719354-ab96-4272-8736-1d8dbe8ef242';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'afaab677-c99e-46e3-afe8-e7cd22a675d8', merged_at = now() WHERE id = 'e4841291-ceae-405d-bf7b-65e51511d110';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '207440af-cc40-425c-a10c-5f8da7d325e8', merged_at = now() WHERE id = '311b678f-ee4d-4a1d-8a1f-7b18ebf24f60';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'c4befa53-58d3-4b2a-bb54-c7b409498293', merged_at = now() WHERE id = '6a1a7fd6-254f-4217-aa97-30ff5f80dde3';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '6b627d3f-c6e7-40cc-b25b-492347a65bdb', merged_at = now() WHERE id = '564b4105-1722-450f-9b70-fd485858bdea';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '92127a32-e8db-40c4-bb95-b9f2ca22a22b', merged_at = now() WHERE id = 'fa51b419-8585-4e77-8a50-a2887c8178bf';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '6d48c9be-3dfa-4fe9-97dc-6ea40a4ea481', merged_at = now() WHERE id = '7834abc4-8d5c-4320-a34b-d035cbc255e0';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '83743cb0-850e-41a0-9539-3fb81b509a38', merged_at = now() WHERE id = 'beb540d6-073b-4378-a975-adf31eff7c29';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'f4ca3bd4-5b9c-4f44-9076-2baff9897942', merged_at = now() WHERE id = 'b8a434e9-17cb-4a9f-aba2-f103553f8573';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '2af60135-3af5-4747-8110-ecc77c472866', merged_at = now() WHERE id = 'd50aeced-e2fa-4d83-9fe3-36233b0271ec';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'c2cf3a01-3da7-46f2-8f5a-1094b19ee4ba', merged_at = now() WHERE id = '129d1de5-e36c-483e-8a28-ed1f96d35e8b';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = 'd5f0a2ec-46f3-4caa-9a09-6b57c25aeb67', merged_at = now() WHERE id = '671d5d37-88cb-4892-85f1-7024a660e57a';
UPDATE crm_contacts SET is_archived = true, merged_into_contact_id = '492e4dc3-f32f-41fb-b95b-575d5b3101ec', merged_at = now() WHERE id = 'b95a6099-055d-485a-b8e6-376dea0d28b7';
