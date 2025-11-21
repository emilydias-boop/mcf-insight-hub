-- Atualizar função para só vincular contatos sem origin_id
CREATE OR REPLACE FUNCTION public.link_contacts_to_origins_via_deals()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Atualiza APENAS contacts que ainda não têm origin_id (origin_id IS NULL)
  -- Usa o origin_id do deal mais recente
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
    AND c.origin_id IS NULL; -- CRÍTICO: só atualizar se ainda não tem origem
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$function$;