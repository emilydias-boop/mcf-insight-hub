-- Painel Comercial BU MCF SOLAR (2026-10-02)
CREATE TABLE public.solar_bi_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_ref date NOT NULL UNIQUE,
  meta_valor numeric,
  meta_agendamento_dia integer,
  closer_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  dias_uteis_override jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solar_bi_metas TO authenticated;
GRANT ALL ON public.solar_bi_metas TO service_role;
ALTER TABLE public.solar_bi_metas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_bi_solar_meta(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'manager') OR public.has_role(_user_id, 'coordenador');
$$;

CREATE POLICY "solar metas select auth" ON public.solar_bi_metas FOR SELECT TO authenticated USING (true);
CREATE POLICY "solar metas insert restricted" ON public.solar_bi_metas FOR INSERT TO authenticated WITH CHECK (public.can_edit_bi_solar_meta(auth.uid()));
CREATE POLICY "solar metas update restricted" ON public.solar_bi_metas FOR UPDATE TO authenticated USING (public.can_edit_bi_solar_meta(auth.uid())) WITH CHECK (public.can_edit_bi_solar_meta(auth.uid()));
CREATE POLICY "solar metas delete restricted" ON public.solar_bi_metas FOR DELETE TO authenticated USING (public.can_edit_bi_solar_meta(auth.uid()));

CREATE TRIGGER trg_solar_bi_metas_updated_at BEFORE UPDATE ON public.solar_bi_metas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC somente leitura
CREATE OR REPLACE FUNCTION public.painel_comercial_solar(p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH lim AS (
  SELECT (p_from::timestamp AT TIME ZONE 'America/Sao_Paulo') AS t0,
         ((p_to + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') AS t1
),
orig AS (SELECT id FROM crm_origins WHERE name = 'PIPELINE MCF SOLAR'),
st AS (
  SELECT
    (SELECT s.id FROM crm_stages s WHERE s.origin_id IN (SELECT id FROM orig) AND s.stage_name = 'Venda realizada' LIMIT 1) AS venda,
    (SELECT s.id FROM crm_stages s WHERE s.origin_id IN (SELECT id FROM orig) AND s.stage_name = 'Contrato Pago' LIMIT 1) AS contrato
),
att AS (
  SELECT a.id, a.status, a.booked_by, a.created_at, a.deal_id, s.scheduled_at, c.id AS closer_id
  FROM meeting_slot_attendees a
  JOIN meeting_slots s ON s.id = a.meeting_slot_id
  JOIN closers c ON c.id = s.closer_id
  WHERE c.bu = 'solar' AND s.meeting_type = 'r1'
    AND COALESCE(a.is_partner, false) = false
    AND a.status IS DISTINCT FROM 'cancelled'
),
ag AS (SELECT att.* FROM att, lim WHERE att.scheduled_at >= lim.t0 AND att.scheduled_at < lim.t1),
cr AS (SELECT att.* FROM att, lim WHERE att.created_at >= lim.t0 AND att.created_at < lim.t1),
-- entrada em etapa: deal_activities stage_change (trigger trg_log_deal_stage_change)
mov AS (
  SELECT DISTINCT ON (da.deal_id, da.metadata->>'to_stage_id') da.deal_id::text AS deal_id, (da.metadata->>'to_stage_id') AS to_stage, da.created_at
  FROM deal_activities da, lim, st
  WHERE da.activity_type = 'stage_change'
    AND da.metadata->>'to_stage_id' IN (st.venda::text, st.contrato::text)
    AND da.created_at >= lim.t0 AND da.created_at < lim.t1
  ORDER BY da.deal_id, da.metadata->>'to_stage_id', da.created_at
),
dono AS (  -- R1 mais recente do negócio define SDR (quem agendou) e closer (quem atendeu)
  SELECT DISTINCT ON (att.deal_id::text) att.deal_id::text AS deal_id, att.booked_by, att.closer_id
  FROM att WHERE att.deal_id IS NOT NULL
  ORDER BY att.deal_id::text, att.scheduled_at DESC
),
vend AS (
  SELECT m.deal_id, m.to_stage, d.booked_by, d.closer_id
  FROM mov m LEFT JOIN dono d ON d.deal_id = m.deal_id
),
st_v AS (SELECT (SELECT venda::text FROM st) v, (SELECT contrato::text FROM st) c),
sdrs AS (SELECT DISTINCT booked_by FROM ag UNION SELECT DISTINCT booked_by FROM cr UNION SELECT DISTINCT booked_by FROM vend),
closers_ids AS (SELECT DISTINCT closer_id FROM ag UNION SELECT DISTINCT closer_id FROM vend WHERE closer_id IS NOT NULL
               UNION SELECT id FROM closers WHERE bu='solar' AND is_active)
SELECT jsonb_build_object(
  'periodo', jsonb_build_object('from', p_from, 'to', p_to, 'fuso', 'America/Sao_Paulo'),
  'fonte_vendas', 'deal_activities.stage_change (metadata.to_stage_id), primeira entrada na etapa dentro do período',
  'totais', jsonb_build_object(
    'agendamentos', (SELECT count(*) FROM cr),
    'agendadas', (SELECT count(*) FROM ag),
    'realizadas', (SELECT count(*) FROM ag WHERE status IN ('completed','contract_paid')),
    'no_show', (SELECT count(*) FROM ag WHERE status = 'no_show'),
    'pendentes_futuras', (SELECT count(*) FROM ag WHERE status = 'invited' AND scheduled_at > now()),
    'pendentes_vencidas', (SELECT count(*) FROM ag WHERE status = 'invited' AND scheduled_at <= now()),
    'remarcadas', (SELECT count(*) FROM ag WHERE status = 'rescheduled'),
    'vendas', (SELECT count(DISTINCT deal_id) FROM vend, st_v WHERE to_stage = st_v.v),
    'contratos_pagos', (SELECT count(DISTINCT deal_id) FROM vend, st_v WHERE to_stage = st_v.c),
    'vendas_posicao_atual', (SELECT count(*) FROM crm_deals d, st WHERE d.stage_id = st.venda),
    'contratos_posicao_atual', (SELECT count(*) FROM crm_deals d, st WHERE d.stage_id = st.contrato),
    'valor_registrado', (SELECT COALESCE(sum(d.value),0) FROM crm_deals d WHERE d.origin_id IN (SELECT id FROM orig) AND COALESCE(d.value,0) > 0)
  ),
  'meta', (SELECT to_jsonb(m) FROM solar_bi_metas m WHERE m.month_ref = date_trunc('month', p_from)::date),
  'sdrs', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'name') FROM (
    SELECT jsonb_build_object(
      'sdr_id', s.booked_by,
      'name', COALESCE(p.full_name, p.email, '(sem agendador)'),
      'email', p.email,
      'na_bu', COALESCE('solar' = ANY(p.squad), false),
      'agendamentos', (SELECT count(*) FROM cr WHERE cr.booked_by IS NOT DISTINCT FROM s.booked_by),
      'agendadas', (SELECT count(*) FROM ag WHERE ag.booked_by IS NOT DISTINCT FROM s.booked_by),
      'realizadas', (SELECT count(*) FROM ag WHERE ag.booked_by IS NOT DISTINCT FROM s.booked_by AND status IN ('completed','contract_paid')),
      'no_show', (SELECT count(*) FROM ag WHERE ag.booked_by IS NOT DISTINCT FROM s.booked_by AND status = 'no_show'),
      'pendentes', (SELECT count(*) FROM ag WHERE ag.booked_by IS NOT DISTINCT FROM s.booked_by AND status IN ('invited','rescheduled')),
      'vendas', (SELECT count(DISTINCT deal_id) FROM vend, st_v WHERE vend.booked_by IS NOT DISTINCT FROM s.booked_by AND to_stage = st_v.v)
    ) x
    FROM sdrs s LEFT JOIN profiles p ON p.id = s.booked_by
  ) q), '[]'::jsonb),
  'closers', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'name') FROM (
    SELECT jsonb_build_object(
      'closer_id', c.id, 'name', c.name, 'email', c.email, 'is_active', c.is_active,
      'agendadas', (SELECT count(*) FROM ag WHERE ag.closer_id = c.id),
      'realizadas', (SELECT count(*) FROM ag WHERE ag.closer_id = c.id AND status IN ('completed','contract_paid')),
      'no_show', (SELECT count(*) FROM ag WHERE ag.closer_id = c.id AND status = 'no_show'),
      'pendentes', (SELECT count(*) FROM ag WHERE ag.closer_id = c.id AND status IN ('invited','rescheduled')),
      'vendas', (SELECT count(DISTINCT deal_id) FROM vend, st_v WHERE vend.closer_id = c.id AND to_stage = st_v.v)
    ) x
    FROM closers c WHERE c.id IN (SELECT closer_id FROM closers_ids)
  ) q), '[]'::jsonb),
  'vendas_sem_r1', (SELECT count(DISTINCT deal_id) FROM vend, st_v WHERE vend.booked_by IS NULL AND vend.closer_id IS NULL AND to_stage = st_v.v)
);
$$;
REVOKE ALL ON FUNCTION public.painel_comercial_solar(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painel_comercial_solar(date, date) TO authenticated, service_role;