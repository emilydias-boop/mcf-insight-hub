-- Índice composto para activity_type + created_at (acelera filtros de data)
CREATE INDEX IF NOT EXISTS idx_deal_activities_type_created 
ON deal_activities (activity_type, created_at DESC);

-- Índice parcial para to_stage em stage_change (acelera buscas de reuniões agendadas)
CREATE INDEX IF NOT EXISTS idx_deal_activities_to_stage_partial 
ON deal_activities (to_stage, created_at DESC) 
WHERE activity_type = 'stage_change';

-- Índice parcial para from_stage em stage_change (acelera buscas de reagendamentos)
CREATE INDEX IF NOT EXISTS idx_deal_activities_from_stage_partial 
ON deal_activities (from_stage, created_at DESC) 
WHERE activity_type = 'stage_change';

-- Aumentar timeout do role authenticated para 30 segundos
ALTER ROLE authenticated SET statement_timeout = '30s';