-- Tabela para armazenar casos detectados de agendamentos fantasmas
CREATE TABLE public.ghost_appointments_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  contact_id UUID,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  sdr_email TEXT NOT NULL,
  sdr_name TEXT,
  
  -- Classificação do caso
  ghost_type TEXT NOT NULL CHECK (ghost_type IN ('tipo_a', 'tipo_b', 'ciclo_infinito', 'regressao')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Métricas
  total_r1_agendada INTEGER NOT NULL DEFAULT 0,
  distinct_days INTEGER NOT NULL DEFAULT 0,
  no_show_count INTEGER NOT NULL DEFAULT 0,
  
  -- Detalhes para auditoria
  detection_reason TEXT NOT NULL,
  movement_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_r1_date TIMESTAMPTZ,
  last_r1_date TIMESTAMPTZ,
  
  -- Status da auditoria
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'confirmed_fraud', 'false_positive')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Data de detecção (para unique constraint)
  detection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_ghost_audit_deal_id ON ghost_appointments_audit(deal_id);
CREATE INDEX idx_ghost_audit_sdr_email ON ghost_appointments_audit(sdr_email);
CREATE INDEX idx_ghost_audit_status ON ghost_appointments_audit(status);
CREATE INDEX idx_ghost_audit_severity ON ghost_appointments_audit(severity);
CREATE INDEX idx_ghost_audit_created_at ON ghost_appointments_audit(created_at DESC);

-- Unique constraint para evitar duplicatas do mesmo deal no mesmo dia
CREATE UNIQUE INDEX idx_ghost_audit_unique_deal_date ON ghost_appointments_audit(deal_id, detection_date);

-- Enable RLS
ALTER TABLE ghost_appointments_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins e coordenadores podem ver todos os casos"
ON ghost_appointments_audit FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coordenador'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Admins e coordenadores podem inserir casos"
ON ghost_appointments_audit FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coordenador'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Admins e coordenadores podem atualizar casos"
ON ghost_appointments_audit FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coordenador'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Apenas admins podem deletar casos"
ON ghost_appointments_audit FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_ghost_appointments_audit_updated_at
BEFORE UPDATE ON ghost_appointments_audit
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Função para detectar agendamentos fantasmas
CREATE OR REPLACE FUNCTION detect_ghost_appointments(days_back INTEGER DEFAULT 14)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  WITH 
  all_events AS (
    SELECT 
      da.deal_id,
      da.created_at,
      da.to_stage,
      da.from_stage,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as owner_email,
      da.metadata
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.created_at >= (NOW() - (days_back || ' days')::interval)
    ORDER BY da.deal_id, da.created_at
  ),
  
  classified_events AS (
    SELECT 
      e.deal_id,
      e.created_at,
      e.to_stage,
      e.from_stage,
      e.owner_email,
      (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date as event_date,
      CASE WHEN UPPER(e.to_stage) LIKE '%REUNI%01%AGENDADA%' 
           OR UPPER(e.to_stage) = 'R1 AGENDADA' 
           OR e.to_stage = '45ac09c8-0f59-46aa-8ba0-3e0d87ca4b26'
      THEN TRUE ELSE FALSE END as is_r1_agendada,
      CASE WHEN UPPER(e.to_stage) LIKE '%NO%SHOW%' 
           OR UPPER(e.to_stage) = 'NO-SHOW'
           OR e.to_stage = '6bb76ad9-3d48-4e91-b24a-c6e8e18d9e9e'
      THEN TRUE ELSE FALSE END as is_no_show,
      CASE WHEN UPPER(e.to_stage) LIKE '%LEAD%QUALIFICADO%'
           OR UPPER(e.to_stage) = 'LEAD QUALIFICADO'
      THEN TRUE ELSE FALSE END as is_lead_qualificado,
      CASE WHEN UPPER(e.to_stage) LIKE '%REUNI%01%REALIZADA%' 
           OR UPPER(e.to_stage) = 'R1 REALIZADA'
           OR e.to_stage = 'da2e1d78-6eb1-4b89-9ef2-48abe7f46bb0'
      THEN TRUE ELSE FALSE END as is_r1_realizada,
      CASE WHEN UPPER(e.to_stage) LIKE '%NOVO%LEAD%'
           OR UPPER(e.to_stage) = 'NOVO LEAD'
      THEN TRUE ELSE FALSE END as is_novo_lead
    FROM all_events e
  ),
  
  deal_summary AS (
    SELECT 
      ce.deal_id,
      ce.owner_email,
      COUNT(*) FILTER (WHERE ce.is_r1_agendada) as total_r1_agendada,
      COUNT(DISTINCT ce.event_date) FILTER (WHERE ce.is_r1_agendada) as distinct_r1_days,
      COUNT(*) FILTER (WHERE ce.is_no_show) as no_show_count,
      MIN(ce.created_at) FILTER (WHERE ce.is_r1_agendada) as first_r1,
      MAX(ce.created_at) FILTER (WHERE ce.is_r1_agendada) as last_r1,
      EXISTS (
        SELECT 1 
        FROM classified_events ce2 
        WHERE ce2.deal_id = ce.deal_id 
          AND ce2.is_r1_agendada 
          AND EXISTS (
            SELECT 1 FROM classified_events ce3 
            WHERE ce3.deal_id = ce2.deal_id 
              AND ce3.is_lead_qualificado 
              AND ce3.created_at > ce2.created_at
              AND ce3.event_date = ce2.event_date
              AND EXISTS (
                SELECT 1 FROM classified_events ce4 
                WHERE ce4.deal_id = ce3.deal_id 
                  AND ce4.is_r1_agendada 
                  AND ce4.created_at > ce3.created_at
                  AND ce4.event_date = ce3.event_date
                  AND NOT EXISTS (
                    SELECT 1 FROM classified_events ce5 
                    WHERE ce5.deal_id = ce3.deal_id 
                      AND ce5.is_no_show 
                      AND ce5.created_at > ce2.created_at 
                      AND ce5.created_at < ce4.created_at
                  )
              )
          )
      ) as has_tipo_a,
      EXISTS (
        SELECT 1 
        FROM classified_events ce2 
        WHERE ce2.deal_id = ce.deal_id 
          AND ce2.is_r1_realizada 
          AND EXISTS (
            SELECT 1 FROM classified_events ce3 
            WHERE ce3.deal_id = ce2.deal_id 
              AND ce3.is_novo_lead 
              AND ce3.created_at > ce2.created_at
          )
      ) as has_regressao,
      json_agg(
        json_build_object(
          'date', ce.created_at,
          'to_stage', ce.to_stage,
          'from_stage', ce.from_stage,
          'owner', ce.owner_email
        ) ORDER BY ce.created_at
      ) as movement_history
    FROM classified_events ce
    GROUP BY ce.deal_id, ce.owner_email
    HAVING COUNT(*) FILTER (WHERE ce.is_r1_agendada) >= 2
       AND COUNT(DISTINCT ce.event_date) FILTER (WHERE ce.is_r1_agendada) >= 2
  ),
  
  classified_cases AS (
    SELECT 
      ds.deal_id::uuid,
      ds.owner_email as sdr_email,
      COALESCE(s.name, p.full_name, ds.owner_email) as sdr_name,
      c.name as contact_name,
      c.email as contact_email,
      c.phone as contact_phone,
      d.contact_id,
      ds.total_r1_agendada,
      ds.distinct_r1_days,
      ds.no_show_count,
      ds.first_r1,
      ds.last_r1,
      ds.movement_history,
      CASE 
        WHEN ds.has_tipo_a THEN 'tipo_a'
        WHEN ds.has_regressao THEN 'regressao'
        WHEN ds.distinct_r1_days >= 4 THEN 'ciclo_infinito'
        WHEN ds.no_show_count >= 2 AND ds.distinct_r1_days >= 2 THEN 'tipo_b'
        ELSE 'tipo_b'
      END as ghost_type,
      CASE 
        WHEN ds.has_tipo_a THEN 'high'
        WHEN ds.has_regressao THEN 'high'
        WHEN ds.distinct_r1_days >= 4 THEN 'critical'
        WHEN ds.distinct_r1_days >= 3 THEN 'high'
        WHEN ds.distinct_r1_days >= 2 AND ds.no_show_count = 0 THEN 'high'
        ELSE 'medium'
      END as severity,
      CASE 
        WHEN ds.has_tipo_a THEN 'R1 Agendada → Lead Qualificado → R1 Agendada no mesmo dia SEM No-Show intermediário'
        WHEN ds.has_regressao THEN 'Regressão estranha: R1 Realizada → Novo Lead'
        WHEN ds.distinct_r1_days >= 4 THEN 'Ciclo infinito: ' || ds.distinct_r1_days || ' dias distintos em R1 Agendada'
        WHEN ds.no_show_count >= 2 AND ds.distinct_r1_days >= 2 THEN 'Múltiplos No-Shows (' || ds.no_show_count || ') com reagendamentos em ' || ds.distinct_r1_days || ' dias distintos'
        ELSE ds.distinct_r1_days || ' movimentações para R1 Agendada em dias distintos sem progressão real'
      END as detection_reason
    FROM deal_summary ds
    LEFT JOIN crm_deals d ON d.id = ds.deal_id::uuid
    LEFT JOIN crm_contacts c ON c.id = d.contact_id
    LEFT JOIN sdr s ON LOWER(s.email) = LOWER(ds.owner_email)
    LEFT JOIN profiles p ON LOWER(p.email) = LOWER(ds.owner_email)
    WHERE ds.distinct_r1_days >= 2
  )
  
  SELECT COALESCE(json_agg(
    json_build_object(
      'deal_id', cc.deal_id,
      'contact_id', cc.contact_id,
      'contact_name', cc.contact_name,
      'contact_email', cc.contact_email,
      'contact_phone', cc.contact_phone,
      'sdr_email', cc.sdr_email,
      'sdr_name', cc.sdr_name,
      'ghost_type', cc.ghost_type,
      'severity', cc.severity,
      'total_r1_agendada', cc.total_r1_agendada,
      'distinct_days', cc.distinct_r1_days,
      'no_show_count', cc.no_show_count,
      'detection_reason', cc.detection_reason,
      'movement_history', cc.movement_history,
      'first_r1_date', cc.first_r1,
      'last_r1_date', cc.last_r1
    ) ORDER BY 
      CASE cc.severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        ELSE 4 
      END,
      cc.distinct_r1_days DESC
  ), '[]'::json) INTO result
  FROM classified_cases cc;
  
  RETURN result;
END;
$$;