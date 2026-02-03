-- ============================================
-- MIGRAÇÃO V6: PASSO 3 - Deletar duplicados e mover restantes
-- ============================================

-- Deletar deals duplicados da A010 Hubla (já transferimos as referências)
DELETE FROM crm_deals d
USING crm_origins o, crm_deals d2
WHERE d.origin_id = o.id
  AND o.name ILIKE '%a010%hubla%'
  AND d2.contact_id = d.contact_id
  AND d2.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
  AND d2.id != d.id;