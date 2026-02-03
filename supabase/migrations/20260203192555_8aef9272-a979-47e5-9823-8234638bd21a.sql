-- ============================================
-- MIGRAÇÃO V6: PASSO 4b - Resolver duplicados internos A010 Hubla
-- (contatos com múltiplos deals em diferentes origens A010 Hubla)
-- ============================================

-- Primeiro: transferir referências para o deal mais antigo de cada contato
-- Depois: deletar deals duplicados do mesmo contato na A010 Hubla
WITH oldest_deals AS (
  -- Para cada contato, pegar o deal mais antigo na A010 Hubla
  SELECT DISTINCT ON (d.contact_id) 
    d.id as keep_id,
    d.contact_id
  FROM crm_deals d
  JOIN crm_origins o ON d.origin_id = o.id
  WHERE o.name ILIKE '%a010%hubla%'
  ORDER BY d.contact_id, d.created_at ASC
),
duplicate_deals AS (
  -- Todos os deals A010 Hubla que NÃO são os mais antigos
  SELECT d.id as delete_id, od.keep_id
  FROM crm_deals d
  JOIN crm_origins o ON d.origin_id = o.id
  JOIN oldest_deals od ON d.contact_id = od.contact_id
  WHERE o.name ILIKE '%a010%hubla%'
    AND d.id != od.keep_id
)
-- Deletar os duplicados (mas primeiro preciso transferir FKs)
DELETE FROM crm_deals 
WHERE id IN (SELECT delete_id FROM duplicate_deals);