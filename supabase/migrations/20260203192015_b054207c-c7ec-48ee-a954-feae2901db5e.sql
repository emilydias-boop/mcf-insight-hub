-- ============================================
-- MIGRAÇÃO V6: PASSO 1 - Marcar deals do pipeline com tag A010
-- ============================================

-- Atualizar deals que JÁ EXISTEM no PIPELINE INSIDE SALES com tag A010
-- (para contatos que tinham deal duplicado na A010 Hubla)
UPDATE crm_deals d
SET 
  tags = CASE 
    WHEN 'A010' = ANY(COALESCE(tags, '{}')) THEN tags 
    ELSE array_append(COALESCE(tags, '{}'), 'A010') 
  END,
  custom_fields = COALESCE(custom_fields, '{}'::jsonb) || '{"a010_compra": true}'::jsonb,
  updated_at = NOW()
WHERE d.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
  AND EXISTS (
    SELECT 1 FROM crm_deals d2
    JOIN crm_origins o ON d2.origin_id = o.id
    WHERE d2.contact_id = d.contact_id
      AND o.name ILIKE '%a010%hubla%'
      AND d2.id != d.id
  );