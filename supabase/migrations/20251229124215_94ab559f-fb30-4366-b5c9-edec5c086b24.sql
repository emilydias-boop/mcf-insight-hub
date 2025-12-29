-- Parte 1: Criar tabela para rastrear duplicatas de activities

-- Tabela para registrar duplicatas detectadas
CREATE TABLE IF NOT EXISTS deal_activities_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_activity_id UUID NOT NULL,
  duplicate_activity_id UUID NOT NULL,
  deal_id TEXT NOT NULL,
  to_stage TEXT,
  from_stage TEXT,
  gap_seconds NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'ignored', 'removed')),
  detected_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_duplicates_deal_id ON deal_activities_duplicates(deal_id);
CREATE INDEX IF NOT EXISTS idx_duplicates_status ON deal_activities_duplicates(status);
CREATE INDEX IF NOT EXISTS idx_duplicates_original ON deal_activities_duplicates(original_activity_id);
CREATE INDEX IF NOT EXISTS idx_duplicates_duplicate ON deal_activities_duplicates(duplicate_activity_id);

-- RLS
ALTER TABLE deal_activities_duplicates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view duplicates" ON deal_activities_duplicates;
CREATE POLICY "Authenticated users can view duplicates"
  ON deal_activities_duplicates FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins and coordenadores can manage duplicates" ON deal_activities_duplicates;
CREATE POLICY "Admins and coordenadores can manage duplicates"
  ON deal_activities_duplicates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));

-- Parte 2: Marcar duplicatas existentes em deal_activities
DO $$
DECLARE
  dup_record RECORD;
  updated_count INTEGER := 0;
  inserted_count INTEGER := 0;
BEGIN
  -- Iterar sobre duplicatas detectadas
  FOR dup_record IN
    WITH ranked_activities AS (
      SELECT 
        id,
        deal_id,
        to_stage,
        from_stage,
        created_at,
        metadata,
        LAG(id) OVER (
          PARTITION BY deal_id, 
                       COALESCE(to_stage, ''), 
                       COALESCE(from_stage, '')
          ORDER BY created_at
        ) as prev_id,
        LAG(created_at) OVER (
          PARTITION BY deal_id, 
                       COALESCE(to_stage, ''), 
                       COALESCE(from_stage, '')
          ORDER BY created_at
        ) as prev_created_at
      FROM deal_activities
      WHERE activity_type = 'stage_change'
        AND created_at >= NOW() - INTERVAL '90 days'
    )
    SELECT 
      id,
      prev_id as original_id,
      deal_id,
      to_stage,
      from_stage,
      EXTRACT(EPOCH FROM (created_at - prev_created_at)) as gap_seconds
    FROM ranked_activities
    WHERE prev_created_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (created_at - prev_created_at)) < 60
      AND prev_id IS NOT NULL
  LOOP
    -- Marcar a activity como duplicata
    UPDATE deal_activities
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'is_duplicate', true,
      'original_activity_id', dup_record.original_id::text,
      'gap_seconds', dup_record.gap_seconds
    )
    WHERE id = dup_record.id
      AND (metadata->>'is_duplicate' IS NULL OR metadata->>'is_duplicate' != 'true');
    
    IF FOUND THEN
      updated_count := updated_count + 1;
    END IF;
    
    -- Inserir na tabela de duplicatas se não existir
    INSERT INTO deal_activities_duplicates (
      original_activity_id,
      duplicate_activity_id,
      deal_id,
      to_stage,
      from_stage,
      gap_seconds,
      status
    )
    VALUES (
      dup_record.original_id,
      dup_record.id,
      dup_record.deal_id,
      dup_record.to_stage,
      dup_record.from_stage,
      dup_record.gap_seconds,
      'pending'
    )
    ON CONFLICT DO NOTHING;
    
    IF FOUND THEN
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Duplicatas marcadas: %, Registros inseridos: %', updated_count, inserted_count;
END $$;