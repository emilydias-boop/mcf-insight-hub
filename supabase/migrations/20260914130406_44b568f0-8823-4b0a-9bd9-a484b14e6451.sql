CREATE OR REPLACE FUNCTION public.painel_incorporador_totais(p_ini date, p_fim date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ag int; v_rz int; v_ns int; v_pd int;
  v_contratos int;
  v_taxa numeric;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim_ef date := LEAST(p_fim, v_hoje);
BEGIN
  -- ===== Reuniões: contagem LITERAL da Agenda R1 (decisão do dono, 14/09/2026) =====
  -- Linha por linha de attendee, sem cap por deal, sem else-if de no-show,
  -- pendentes contados direto. Espelha src/hooks/useR1CloserMetrics.ts.
  WITH base AS (
    SELECT msa.status
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    JOIN closers c ON c.id = ms.closer_id
    WHERE ms.meeting_type = 'r1'
      AND COALESCE(ms.status, '') NOT IN ('cancelled', 'canceled')
      AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
      AND msa.is_partner = false
      AND msa.deal_id IS NOT NULL
      AND msa.status IN ('scheduled','invited','completed','no_show','contract_paid','refunded','rescheduled')
      AND c.bu = 'incorporador'
      AND c.is_active = true
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('completed','contract_paid','refunded')),
    COUNT(*) FILTER (WHERE status = 'no_show'),
    COUNT(*) FILTER (WHERE status IN ('scheduled','invited','rescheduled'))
  INTO v_ag, v_rz, v_ns, v_pd
  FROM base;

  -- ===== Contratos: mesmo universo do card CONTRATOS =====
  -- cauções do eixo SDR (SDRs válidos do squad no período, sem cargo
  -- administrativo/closer) + transações de contrato órfãs ("não atribuídos").
  WITH allowed AS (
    SELECT lower(s.email) AS email
    FROM public.get_sdrs_for_squad_in_period(
      'incorporador', p_ini::timestamptz, (p_fim + 1)::timestamptz - interval '1 second'
    ) s
    WHERE lower(s.email) NOT IN (
      SELECT lower(p.email) FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE ur.role::text IN ('admin','manager','coordenador','assistente_administrativo','closer','closer_sombra')
        AND p.email IS NOT NULL
    )
  ),
  ce AS (
    SELECT * FROM public.caucoes_efetivas(p_ini, v_fim_ef, 'incorporador')
  ),
  ce_sdr AS (
    SELECT count(*) AS n FROM ce
    WHERE refunded_at IS NULL AND lower(sdr_email) IN (SELECT email FROM allowed)
  ),
  tx AS (
    SELECT t.*
    FROM hubla_transactions t
    WHERE (t.sale_date AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
      AND lower(t.sale_status) IN ('pago','paid','approved','completed')
      AND (
        upper(COALESCE(t.product_code, '')) LIKE 'A000%'
        OR upper(COALESCE(t.product_name, '')) LIKE '%A000%'
        OR upper(COALESCE(t.product_name, '')) LIKE '%CONTRATO%'
      )
  ),
  orphan AS (
    SELECT * FROM tx
    WHERE NOT (linked_attendee_id IS NOT NULL AND linked_attendee_id IN (SELECT attendee_id FROM ce))
      AND NOT (linked_deal_id IS NOT NULL AND linked_deal_id IN (
        SELECT deal_id FROM ce WHERE closer_id IS NOT NULL AND deal_id IS NOT NULL
      ))
  ),
  covered AS (
    SELECT DISTINCT msa.deal_id
    FROM meeting_slot_attendees msa
    WHERE msa.contract_paid_at IS NOT NULL
      AND msa.deal_id IN (SELECT linked_deal_id FROM orphan WHERE linked_deal_id IS NOT NULL)
  ),
  orphan_final AS (
    SELECT DISTINCT ON (COALESCE(linked_deal_id::text, id::text)) id
    FROM orphan
    WHERE linked_deal_id IS NULL OR linked_deal_id NOT IN (SELECT deal_id FROM covered)
  )
  SELECT (SELECT n FROM ce_sdr) + (SELECT count(*) FROM orphan_final)
  INTO v_contratos;

  v_taxa := CASE WHEN COALESCE(v_ag, 0) > 0
    THEN round(v_ns::numeric / v_ag::numeric, 4)
    ELSE NULL END;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('ini', p_ini::text, 'fim', p_fim::text),
    'r1_agendada', COALESCE(v_ag, 0),
    'r1_realizada', COALESCE(v_rz, 0),
    'no_shows', COALESCE(v_ns, 0),
    'pendentes', COALESCE(v_pd, 0),
    'taxa_no_show', v_taxa,
    'contratos_pagos', COALESCE(v_contratos, 0),
    'gerado_em', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS')
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.painel_incorporador_totais(date, date) TO authenticated, service_role;