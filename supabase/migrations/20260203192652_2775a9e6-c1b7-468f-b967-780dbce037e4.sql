-- ============================================
-- MIGRAÇÃO V6: PASSO 5 FINAL - Mover restantes e limpar origens
-- ============================================

-- Mover deals restantes para PIPELINE INSIDE SALES
UPDATE crm_deals
SET 
  origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  updated_at = NOW()
WHERE origin_id IN (
  SELECT id FROM crm_origins WHERE name ILIKE '%a010%hubla%'
);

-- Atualizar contatos para PIPELINE INSIDE SALES
UPDATE crm_contacts
SET 
  origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  updated_at = NOW()
WHERE origin_id IN (
  SELECT id FROM crm_origins WHERE name ILIKE '%a010%hubla%'
);

-- Deletar todas as origens "A010 Hubla" (agora vazias)
DELETE FROM crm_origins 
WHERE name ILIKE '%a010%hubla%';