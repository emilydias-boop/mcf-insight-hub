-- Migração 1: Criar View Materializada para status atual dos deals
-- Isso evita recalcular o estágio atual em cada chamada da função

-- Drop se existir (para recriar)
DROP MATERIALIZED VIEW IF EXISTS deal_current_stages;

-- Criar view materializada com estágio atual de cada deal
CREATE MATERIALIZED VIEW deal_current_stages AS
SELECT DISTINCT ON (deal_id)
  deal_id,
  LOWER(COALESCE(to_stage, '')) as current_stage_lower,
  COALESCE(to_stage, '') as current_stage,
  created_at as last_stage_change
FROM deal_activities
WHERE activity_type = 'stage_change'
ORDER BY deal_id, created_at DESC;

-- Índice único para refresh concorrente e busca rápida
CREATE UNIQUE INDEX idx_deal_current_stages_deal_id 
ON deal_current_stages (deal_id);

-- Índice para filtrar por estágio
CREATE INDEX idx_deal_current_stages_stage 
ON deal_current_stages (current_stage_lower);

-- Função para refresh (pode ser chamada via cron ou trigger)
CREATE OR REPLACE FUNCTION refresh_deal_current_stages()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY deal_current_stages;
END;
$$;

-- Fazer refresh inicial
SELECT refresh_deal_current_stages();