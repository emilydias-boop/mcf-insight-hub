-- Função para vincular contacts com origins baseado nos deals mais recentes
CREATE OR REPLACE FUNCTION link_contacts_to_origins_via_deals()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Atualiza contacts com origin_id do deal mais recente de cada contato
  WITH latest_deals AS (
    SELECT DISTINCT ON (d.contact_id)
      d.contact_id,
      d.origin_id
    FROM crm_deals d
    WHERE d.contact_id IS NOT NULL 
      AND d.origin_id IS NOT NULL
    ORDER BY d.contact_id, d.updated_at DESC NULLS LAST, d.created_at DESC
  )
  UPDATE crm_contacts c
  SET origin_id = ld.origin_id,
      updated_at = NOW()
  FROM latest_deals ld
  WHERE c.id = ld.contact_id
    AND (c.origin_id IS NULL OR c.origin_id != ld.origin_id);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;