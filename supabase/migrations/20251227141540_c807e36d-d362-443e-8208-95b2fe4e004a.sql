
-- Corrigir deal do Jesus Gomez: atualizar stage para No-Show e clint_id para o ID correto do Clint
UPDATE crm_deals 
SET 
  stage_id = '8f170b9b-5c99-43ce-afeb-896e1a6f4151',
  clint_id = '96689cf0-5ba3-4bb7-8d95-5fc5836aa4bd',
  updated_at = NOW()
WHERE id = '1afd85cc-2f2e-4b5f-ad82-bef904502ef0';
