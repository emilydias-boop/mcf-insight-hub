DROP FUNCTION IF EXISTS public.relatorio_diario_bu(date);

CREATE FUNCTION public.relatorio_diario_bu(p_data date)
 RETURNS TABLE(bu text, metrica text, valor numeric, status text, agregacao text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
-- Retrato de UM dia (corte America/Sao_Paulo). Reaproveita os RPCs do painel.
-- agregacao:
--   'aditivo'      -> pode somar entre dias.
--   'nao_somavel'  -> deduplica por deal/cliente (ou e razao). A soma de N dias
--                     e >= o valor do periodo; o fechamento do mes se le no painel.
WITH
-- ══ INCORPORADOR — reaproveita o RPC do painel diário (mesma dedup/cap/fuso)
dv AS (
  SELECT public.get_daily_view_incorporador(
           p_data, 0, 0,
           '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], '{}'::uuid[]
         )::jsonb AS j
),
inc_dv AS (
  SELECT
    (SELECT coalesce(sum((s->>'agendamentos')::numeric), 0)
       FROM jsonb_array_elements(coalesce(j->'sdrs', '[]'::jsonb)) s)          AS r01_agendada,
    (SELECT coalesce(sum((c->>'reunioes_realizadas')::numeric), 0)
       FROM jsonb_array_elements(coalesce(j->'closers', '[]'::jsonb)) c)       AS r01_realizada,
    (SELECT coalesce(sum((c->>'contratos_pagos')::numeric), 0)
       FROM jsonb_array_elements(coalesce(j->'closers', '[]'::jsonb)) c)       AS contrato_pago
  FROM dv
),
-- R02: nao existe RPC. Espelha useR2MeetingSlotsKPIs (eixo scheduled_at, corte BRT)
inc_r2 AS (
  SELECT
    count(*) FILTER (WHERE msa.status NOT IN ('cancelled', 'rescheduled'))::numeric        AS r02_agendada,
    count(*) FILTER (WHERE msa.status IN ('completed', 'contract_paid', 'refunded'))::numeric AS r02_realizada
  FROM public.meeting_slot_attendees msa
  JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
  WHERE ms.meeting_type = 'r2'
    AND coalesce(msa.is_partner, false) = false
    AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = p_data
),
-- Venda Realizada: espelha useR2VendasKPIs (deal_activities.to_stage), corte BRT
inc_venda AS (
  SELECT count(*)::numeric AS venda_realizada
  FROM public.deal_activities da
  WHERE da.to_stage = 'Venda realizada'
    AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date = p_data
),
-- Faturamento Liquido: reaproveita o RPC de transacoes por BU (mesmas exclusoes)
inc_fat AS (
  SELECT coalesce(sum(t.net_value), 0)::numeric AS faturamento_liquido
  FROM public.get_hubla_transactions_by_bu(
         'incorporador',
         NULL,
         p_data::text || 'T00:00:00-03:00',
         p_data::text || 'T23:59:59.999-03:00',
         1000000
       ) t
  WHERE coalesce(btrim(t.customer_email), '') <> ''
    AND (coalesce(t.net_value, 0) > 0 OR coalesce(t.product_price, 0) > 0)
),
-- ══ CONSORCIO — reaproveita o RPC de fatos de agenda (BU pelo closer, corte BRT)
cons_ag AS (
  SELECT
    count(*) FILTER (WHERE f.fato = 'agendada')::numeric  AS reuniao_agendada,
    count(*) FILTER (WHERE f.fato = 'realizada')::numeric AS reuniao_realizada
  FROM public.get_agenda_fatos_consorcio(p_data::text, p_data::text) f
),
-- Producao Gerada: reaproveita a RPC das 3 pernas (nao reimplementa nada)
cons_prod AS (
  SELECT public.consorcio_producao_gerada(p_data, p_data, 'consorcio') AS j
),
cons_prod_v AS (
  SELECT coalesce((j -> 'total' ->> 'credito')::numeric, 0) AS credito
  FROM cons_prod
),
-- Cotas / clientes / credito efetivado: espelha useConsorcioCotasContratadas
cons_cards AS (
  SELECT
    c.id,
    coalesce(c.valor_credito, 0) AS valor_credito,
    public.consorcio_chave_cliente(c.cpf, c.cnpj, c.nome_completo, c.id) AS cliente_key
  FROM public.consortium_cards c
  WHERE c.tipo_registro = 'contratacao'
    AND c.data_contratacao = p_data
),
cons_cards_agg AS (
  SELECT
    count(*)::numeric                          AS cotas_contratadas,
    count(DISTINCT cliente_key)::numeric       AS venda_realizada,
    coalesce(sum(valor_credito), 0)::numeric   AS consorcios_efetivados
  FROM cons_cards
),
linhas AS (
  -- INCORPORADOR
  SELECT 1 AS ord, 'incorporador'::text AS bu, 'r01_agendada'::text AS metrica,
         (SELECT r01_agendada FROM inc_dv) AS valor, 'ok'::text AS status,
         'nao_somavel'::text AS agregacao
  UNION ALL SELECT 2, 'incorporador', 'r01_realizada', (SELECT r01_realizada FROM inc_dv), 'ok', 'nao_somavel'
  UNION ALL SELECT 3, 'incorporador', 'contrato_pago', (SELECT contrato_pago FROM inc_dv), 'ok', 'nao_somavel'
  UNION ALL SELECT 4, 'incorporador', 'r02_agendada', (SELECT r02_agendada FROM inc_r2), 'ok', 'aditivo'
  UNION ALL SELECT 5, 'incorporador', 'r02_realizada', (SELECT r02_realizada FROM inc_r2), 'ok', 'aditivo'
  UNION ALL SELECT 6, 'incorporador', 'venda_realizada', (SELECT venda_realizada FROM inc_venda), 'ok', 'aditivo'
  UNION ALL SELECT 7, 'incorporador', 'faturamento_liquido', (SELECT faturamento_liquido FROM inc_fat), 'ok', 'aditivo'
  UNION ALL SELECT 8, 'incorporador', 'ticket_medio',
       (SELECT (SELECT faturamento_liquido FROM inc_fat)
               / nullif((SELECT venda_realizada FROM inc_venda), 0)), 'ok', 'nao_somavel'
  -- CONSORCIO
  UNION ALL SELECT 9,  'consorcio', 'reuniao_agendada', (SELECT reuniao_agendada FROM cons_ag), 'ok', 'nao_somavel'
  UNION ALL SELECT 10, 'consorcio', 'reuniao_realizada', (SELECT reuniao_realizada FROM cons_ag), 'ok', 'nao_somavel'
  UNION ALL SELECT 11, 'consorcio', 'venda_realizada', (SELECT venda_realizada FROM cons_cards_agg), 'ok', 'nao_somavel'
  UNION ALL SELECT 12, 'consorcio', 'producao_gerada', (SELECT credito FROM cons_prod_v), 'ok', 'aditivo'
  UNION ALL SELECT 13, 'consorcio', 'cotas_contratadas', (SELECT cotas_contratadas FROM cons_cards_agg), 'ok', 'aditivo'
  UNION ALL SELECT 14, 'consorcio', 'consorcios_efetivados', (SELECT consorcios_efetivados FROM cons_cards_agg), 'ok', 'aditivo'
  -- Ticket Medio Consorcio: espelha ConsorcioCloserSummaryTable.tsx:181
  -- (credito efetivado / clientes distintos). Dia sem contratacao -> NULL, status 'ok'.
  UNION ALL SELECT 15, 'consorcio', 'ticket_medio',
       (SELECT consorcios_efetivados / nullif(venda_realizada, 0) FROM cons_cards_agg), 'ok', 'nao_somavel'
)
SELECT bu, metrica, valor, status, agregacao FROM linhas ORDER BY ord;
$function$;

GRANT EXECUTE ON FUNCTION public.relatorio_diario_bu(date) TO authenticated, service_role;