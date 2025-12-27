-- PARTE 1: Corrigir os 264 clint_ids únicos (sem conflito)
WITH corrected_ids AS (
  SELECT DISTINCT ON (d.id)
    d.id as deal_id,
    da.metadata->>'deal_id' as real_clint_id
  FROM crm_deals d
  INNER JOIN deal_activities da ON d.id::text = da.deal_id
  WHERE d.clint_id LIKE 'hubla-deal-%'
    AND da.metadata->>'deal_id' IS NOT NULL
    AND da.metadata->>'deal_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    -- Excluir os que têm conflito (já existe outro deal com esse clint_id)
    AND NOT EXISTS (
      SELECT 1 FROM crm_deals d2 
      WHERE d2.clint_id = da.metadata->>'deal_id'
    )
  ORDER BY d.id, da.created_at DESC
)
UPDATE crm_deals d
SET 
  clint_id = c.real_clint_id,
  updated_at = NOW()
FROM corrected_ids c
WHERE d.id = c.deal_id;

-- PARTE 2: Para os 13 duplicados, deletar o deal hubla-deal-* (o deal original do Clint já existe)
WITH duplicates_to_delete AS (
  SELECT DISTINCT ON (d.id)
    d.id as deal_id
  FROM crm_deals d
  INNER JOIN deal_activities da ON d.id::text = da.deal_id
  WHERE d.clint_id LIKE 'hubla-deal-%'
    AND da.metadata->>'deal_id' IS NOT NULL
    AND da.metadata->>'deal_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    -- Apenas os que têm conflito
    AND EXISTS (
      SELECT 1 FROM crm_deals d2 
      WHERE d2.clint_id = da.metadata->>'deal_id'
    )
  ORDER BY d.id, da.created_at DESC
)
DELETE FROM crm_deals 
WHERE id IN (SELECT deal_id FROM duplicates_to_delete);

-- PARTE 3: Criar função SQL para reconciliação automática
CREATE OR REPLACE FUNCTION public.reconcile_hubla_clint_ids()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  fixed_count INTEGER := 0;
  deleted_count INTEGER := 0;
BEGIN
  -- Corrigir clint_ids únicos (sem conflito)
  WITH corrected_ids AS (
    SELECT DISTINCT ON (d.id)
      d.id as deal_id,
      da.metadata->>'deal_id' as real_clint_id
    FROM crm_deals d
    INNER JOIN deal_activities da ON d.id::text = da.deal_id
    WHERE d.clint_id LIKE 'hubla-deal-%'
      AND da.metadata->>'deal_id' IS NOT NULL
      AND da.metadata->>'deal_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND NOT EXISTS (
        SELECT 1 FROM crm_deals d2 
        WHERE d2.clint_id = da.metadata->>'deal_id'
      )
    ORDER BY d.id, da.created_at DESC
  )
  UPDATE crm_deals d
  SET 
    clint_id = c.real_clint_id,
    updated_at = NOW()
  FROM corrected_ids c
  WHERE d.id = c.deal_id;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  -- Deletar duplicados (deal Hubla quando já existe deal Clint)
  WITH duplicates_to_delete AS (
    SELECT DISTINCT ON (d.id)
      d.id as deal_id
    FROM crm_deals d
    INNER JOIN deal_activities da ON d.id::text = da.deal_id
    WHERE d.clint_id LIKE 'hubla-deal-%'
      AND da.metadata->>'deal_id' IS NOT NULL
      AND da.metadata->>'deal_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND EXISTS (
        SELECT 1 FROM crm_deals d2 
        WHERE d2.clint_id = da.metadata->>'deal_id'
      )
    ORDER BY d.id, da.created_at DESC
  )
  DELETE FROM crm_deals 
  WHERE id IN (SELECT deal_id FROM duplicates_to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  SELECT json_build_object(
    'fixed_count', fixed_count,
    'deleted_duplicates', deleted_count,
    'executed_at', NOW(),
    'remaining', (
      SELECT COUNT(*) 
      FROM crm_deals 
      WHERE clint_id LIKE 'hubla-deal-%'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;