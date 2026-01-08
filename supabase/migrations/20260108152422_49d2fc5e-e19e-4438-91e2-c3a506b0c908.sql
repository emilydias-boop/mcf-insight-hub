-- Habilitar extensão pg_trgm para índices trigram (acelera LIKE '%...%')
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice GIN trigram para to_stage (acelera buscas por reunião agendada, no-show, etc.)
CREATE INDEX IF NOT EXISTS idx_da_to_stage_trgm
ON deal_activities
USING gin (lower(coalesce(to_stage,'')) gin_trgm_ops)
WHERE activity_type = 'stage_change';

-- Índice GIN trigram para from_stage (acelera buscas por reagendamentos vindos de no-show)
CREATE INDEX IF NOT EXISTS idx_da_from_stage_trgm
ON deal_activities
USING gin (lower(coalesce(from_stage,'')) gin_trgm_ops)
WHERE activity_type = 'stage_change';

-- Índice para owner_email em metadata (acelera filtros por SDR)
CREATE INDEX IF NOT EXISTS idx_da_owner_email
ON deal_activities (lower(coalesce(metadata->>'owner_email', metadata->>'deal_user', '')))
WHERE activity_type = 'stage_change';

-- Índice de expressão para deal_id como UUID (acelera joins com crm_deals)
CREATE INDEX IF NOT EXISTS idx_da_deal_id_uuid
ON deal_activities ((deal_id::uuid))
WHERE activity_type = 'stage_change'
  AND deal_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';