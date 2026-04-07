
-- 1. Delete 3 duplicate deals from Viver de Aluguel
DELETE FROM crm_deals WHERE id IN (
  '6bc06254-bb94-4bae-b658-5d44e61fc6b1',
  '3f78d7ce-aea9-42ce-920c-e0e1dc5aa23e',
  '790d6133-02e7-4da3-adb7-af0f98db714c'
);

-- 2. Move Allan Calado to Inside Sales
UPDATE crm_deals SET 
  origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  stage_id = 'e6fab26d-f16d-4b00-900f-ca915cbfe9d9',
  name = 'ALLAN CALADO GOMES DE LIMA - A010',
  tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'ob-construir-alugar'),
  updated_at = now()
WHERE id = 'a89dbc2f-e27c-49da-b87e-b66e29af55a3';

-- 3. Move Paulo Eduardo to Inside Sales
UPDATE crm_deals SET 
  origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  stage_id = 'e6fab26d-f16d-4b00-900f-ca915cbfe9d9',
  name = 'Paulo Eduardo Codello Rebelo - A010',
  tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'ob-construir-alugar'),
  updated_at = now()
WHERE id = 'e1ebf0de-79f4-44a0-90f6-b450946ca842';

-- 4. Hilton Jamal: primary already has deal in Inside Sales, delete secondary's duplicate deal
DELETE FROM crm_deals WHERE id = '475bb5f2-ff8c-4c2e-9e6e-b97e40a160a8';

-- 5. Archive secondary Hilton Jamal contact
UPDATE crm_contacts SET 
  is_archived = true,
  merged_into_contact_id = '3a2cf03e-7a66-46fa-9897-52b7d05a5055',
  merged_at = now()
WHERE id = 'bf7ae91e-61bd-4e92-ac6c-9c9eb687aa73';
