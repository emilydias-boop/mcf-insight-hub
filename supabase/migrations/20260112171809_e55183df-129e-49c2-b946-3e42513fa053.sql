-- Criar função RPC para buscar contato com contagem de meetings e deals
-- Retorna o contato com mais reuniões, depois mais deals, depois mais antigo
CREATE OR REPLACE FUNCTION get_contact_with_meetings(
  p_email TEXT DEFAULT NULL,
  p_phone_suffix TEXT DEFAULT NULL
)
RETURNS TABLE(
  contact_id UUID,
  contact_name TEXT,
  deals_count BIGINT,
  meetings_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as contact_id,
    c.name as contact_name,
    COUNT(DISTINCT d.id) as deals_count,
    COUNT(DISTINCT ms.id) as meetings_count
  FROM crm_contacts c
  LEFT JOIN crm_deals d ON d.contact_id = c.id
  LEFT JOIN meeting_slots ms ON ms.deal_id = d.id
  WHERE 
    (p_email IS NOT NULL AND LOWER(c.email) = LOWER(p_email))
    OR (p_phone_suffix IS NOT NULL AND c.phone ILIKE '%' || p_phone_suffix)
  GROUP BY c.id, c.name, c.created_at
  ORDER BY 
    COUNT(DISTINCT ms.id) DESC,  -- Priorizar quem tem reuniões
    COUNT(DISTINCT d.id) DESC,   -- Depois quem tem deals
    c.created_at ASC             -- Depois o mais antigo
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;