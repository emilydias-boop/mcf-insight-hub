-- Dropar função existente e recriar com fallback para identificar SDR
DROP FUNCTION IF EXISTS get_sdr_all_movements_v2(DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION get_sdr_all_movements_v2(
  start_date DATE,
  end_date DATE,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  deal_id TEXT,
  deal_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  tipo TEXT,
  data_agendamento TIMESTAMPTZ,
  status_atual TEXT,
  intermediador TEXT,
  current_owner TEXT,
  closer TEXT,
  origin_name TEXT,
  probability INTEGER,
  conta BOOLEAN,
  total_movimentacoes INTEGER,
  from_stage TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH r1_movements AS (
    SELECT 
      da.deal_id as mov_deal_id,
      da.created_at,
      (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date as mov_date,
      -- FALLBACK para identificar SDR:
      -- 1. metadata->>'owner_email' ou metadata->>'deal_user' da própria atividade
      -- 2. booked_by do meeting_slot associado ao deal
      -- 3. owner_email de uma atividade posterior do mesmo deal
      COALESCE(
        NULLIF(da.metadata->>'owner_email', ''),
        NULLIF(da.metadata->>'deal_user', ''),
        (
          SELECT p.email 
          FROM meeting_slots ms
          JOIN profiles p ON p.id = ms.booked_by
          WHERE ms.deal_id::text = da.deal_id::text
          ORDER BY ms.created_at ASC
          LIMIT 1
        ),
        (
          SELECT COALESCE(
            NULLIF(da2.metadata->>'owner_email', ''),
            NULLIF(da2.metadata->>'deal_user', '')
          )
          FROM deal_activities da2
          WHERE da2.deal_id = da.deal_id
            AND da2.created_at > da.created_at
            AND (
              NULLIF(da2.metadata->>'owner_email', '') IS NOT NULL 
              OR NULLIF(da2.metadata->>'deal_user', '') IS NOT NULL
            )
          ORDER BY da2.created_at ASC
          LIMIT 1
        )
      ) as sdr_email,
      COALESCE(da.from_stage, 
        CASE 
          WHEN da.description LIKE '%→%' THEN TRIM(split_part(regexp_replace(da.description, '^[^:]*: ', ''), ' → ', 1))
          WHEN da.description LIKE '%movido de%' THEN TRIM(split_part(split_part(da.description, 'movido de ', 2), ' para ', 1))
        END
      ) as from_stg,
      COALESCE(da.to_stage,
        CASE 
          WHEN da.description LIKE '%→%' THEN TRIM(split_part(regexp_replace(da.description, '^[^:]*: ', ''), ' → ', 2))
          WHEN da.description LIKE '%movido de%' THEN TRIM(split_part(da.description, ' para ', 2))
        END
      ) as to_stg
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
  ),
  filtered_movements AS (
    SELECT 
      rm.*,
      CASE 
        WHEN rm.from_stg ILIKE '%No-Show%' OR rm.from_stg ILIKE '%No Show%' OR rm.from_stg ILIKE '%NoShow%' THEN 'Reagendamento Válido'
        ELSE '1º Agendamento'
      END as tipo_mov
    FROM r1_movements rm
    WHERE (
        rm.to_stg ILIKE '%Reunião 01 Agendada%'
        OR rm.to_stg ILIKE '%Reuniao 01 Agendada%'
        OR rm.to_stg ILIKE '%R1 Agendada%'
      )
      AND (
        rm.from_stg ILIKE '%Lead Qualificado%'
        OR rm.from_stg ILIKE '%LQ%'
        OR rm.from_stg ILIKE '%No-Show%'
        OR rm.from_stg ILIKE '%No Show%'
        OR rm.from_stg ILIKE '%NoShow%'
        OR rm.from_stg ILIKE '%Novo Lead%'
        OR rm.from_stg ILIKE '%Sem Interesse%'
      )
  ),
  deduplicated_movements AS (
    SELECT DISTINCT ON (mov_deal_id, from_stg, to_stg, DATE_TRUNC('minute', created_at))
      mov_deal_id,
      created_at,
      mov_date,
      sdr_email,
      from_stg,
      to_stg,
      tipo_mov,
      ROW_NUMBER() OVER (
        PARTITION BY mov_deal_id 
        ORDER BY created_at ASC
      ) as rn_deal
    FROM filtered_movements
    ORDER BY mov_deal_id, from_stg, to_stg, DATE_TRUNC('minute', created_at), created_at ASC
  ),
  movement_counts AS (
    SELECT 
      dm.mov_deal_id as cnt_deal_id,
      COUNT(*) as total_movs
    FROM deduplicated_movements dm
    GROUP BY dm.mov_deal_id
  ),
  current_stages AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id as cs_deal_id,
      COALESCE(da.to_stage,
        CASE 
          WHEN da.description LIKE '%→%' THEN TRIM(split_part(regexp_replace(da.description, '^[^:]*: ', ''), ' → ', 2))
          WHEN da.description LIKE '%movido de%' THEN TRIM(split_part(da.description, ' para ', 2))
        END
      ) as current_stage
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
    ORDER BY da.deal_id, da.created_at DESC
  )
  SELECT 
    dm.mov_deal_id::TEXT,
    d.name::TEXT,
    c.name::TEXT,
    c.email::TEXT,
    c.phone::TEXT,
    dm.tipo_mov::TEXT,
    dm.created_at,
    COALESCE(cs.current_stage, 'Desconhecido')::TEXT,
    dm.sdr_email::TEXT,
    d.owner_id::TEXT,
    NULL::TEXT,
    o.name::TEXT,
    d.probability::INTEGER,
    (dm.rn_deal = 1)::BOOLEAN as conta_mov,
    COALESCE(mc.total_movs, 1)::INTEGER,
    dm.from_stg::TEXT
  FROM deduplicated_movements dm
  LEFT JOIN crm_deals d ON dm.mov_deal_id = d.id::TEXT
  LEFT JOIN crm_contacts c ON d.contact_id = c.id
  LEFT JOIN crm_origins o ON d.origin_id = o.id
  LEFT JOIN current_stages cs ON dm.mov_deal_id = cs.cs_deal_id
  LEFT JOIN movement_counts mc ON dm.mov_deal_id = mc.cnt_deal_id
  WHERE dm.sdr_email IS NOT NULL
    AND (sdr_email_filter IS NULL OR LOWER(dm.sdr_email) = LOWER(sdr_email_filter))
  ORDER BY dm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';