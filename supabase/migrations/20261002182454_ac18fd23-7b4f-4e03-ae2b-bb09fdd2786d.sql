CREATE OR REPLACE FUNCTION public._rdo_m(p_dia numeric, p_mes numeric, p_meta numeric, p_agregacao text, p_obs text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object('observacao', p_obs))
      || jsonb_build_object('dia', p_dia, 'mes', p_mes, 'meta', p_meta, 'agregacao', p_agregacao);
$$;
REVOKE ALL ON FUNCTION public._rdo_m(numeric,numeric,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._rdo_m(numeric,numeric,numeric,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.relatorio_diario_operacoes(p_data date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ini date := date_trunc('month', p_data)::date;
  v_t0d timestamptz := (p_data::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_t0m timestamptz := (v_ini::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_t1  timestamptz := ((p_data + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
  SEM text := 'não registrado no sistema';
  -- incorporador
  d_inc jsonb; m_inc jsonb; meta_inc record;
  i_r1ag_m numeric; i_r1re_m numeric; i_ns_d numeric; i_ns_m numeric; i_cp_m numeric;
  i_r2ag_m numeric; i_r2re_m numeric; i_vd_m numeric; i_fat_m numeric;
  -- consorcio
  d_con jsonb; meta_con record;
  c_ag_m numeric; c_re_m numeric; c_ns_d numeric; c_ns_m numeric; c_prod_m numeric;
  c_cotas_m numeric; c_vend_m numeric; c_valor_m numeric;
  -- solar / credito
  s_d jsonb; s_m jsonb; meta_sol record;
  cr_d jsonb; cr_m jsonb; cr_est_d jsonb; cr_est_m jsonb;
  -- gr / cobrança
  gr_d numeric; gr_m numeric; gr_lista jsonb;
  ci jsonb; cc jsonb;
BEGIN
  -- ═══ 1. INCORPORADOR ═══
  SELECT jsonb_object_agg(r.metrica, r.valor) INTO d_inc FROM public.relatorio_diario_bu(p_data) r WHERE r.bu = 'incorporador';

  -- R1 agendadas no mês: mesma régua do get_daily_view_incorporador aplicada ao período inteiro
  WITH sdrs AS (
    SELECT DISTINCT LOWER(s.email) AS email, d::date AS dia
    FROM public.sdr s
    CROSS JOIN generate_series(v_ini, p_data, interval '1 day') d
    LEFT JOIN public.sdr_squad_history h ON h.sdr_id = s.id
      AND h.valid_from::date <= d::date AND COALESCE(h.valid_to::date, '9999-12-31') >= d::date
    WHERE s.active = true AND (h.squad = 'incorporador' OR (h.id IS NULL AND s.squad = 'incorporador'))
  ),
  att AS (
    SELECT LOWER(pb.email) AS sdr_email, msa.deal_id,
           (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS meeting_day,
           (MIN(COALESCE(msa.booked_at, msa.created_at)) AT TIME ZONE 'America/Sao_Paulo')::date AS booked_day
    FROM public.meeting_slot_attendees msa
    JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN public.profiles pb ON pb.id = msa.booked_by
    WHERE ms.meeting_type = 'r1' AND msa.is_partner = false AND msa.status <> 'cancelled'
      AND pb.email IS NOT NULL AND msa.deal_id IS NOT NULL
    GROUP BY 1, 2, 3
  ),
  att_p AS (
    SELECT a.* FROM att a JOIN sdrs s ON s.email = a.sdr_email AND s.dia = a.booked_day
    WHERE a.booked_day BETWEEN v_ini AND p_data
  )
  SELECT COALESCE(SUM(LEAST(n, 2)), 0) INTO i_r1ag_m
  FROM (SELECT sdr_email, deal_id, count(*) n FROM att_p GROUP BY 1, 2) x;

  SELECT count(*) INTO i_r1re_m FROM (
    SELECT DISTINCT ms.closer_id, msa.deal_id
    FROM public.meeting_slot_attendees msa
    JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
    JOIN public.closers c ON c.id = ms.closer_id
    WHERE ms.meeting_type = 'r1' AND msa.is_partner = false AND msa.deal_id IS NOT NULL
      AND msa.status IN ('completed','contract_paid','refunded')
      AND c.is_active = true AND COALESCE(c.bu,'incorporador') = 'incorporador' AND COALESCE(c.meeting_type,'r1') = 'r1'
      AND ms.scheduled_at >= v_t0m AND ms.scheduled_at < v_t1
  ) x;

  -- No-show R1: uma linha de participante = uma reunião; parceiro fora; cancelada fora
  SELECT count(*) FILTER (WHERE ms.scheduled_at >= v_t0d), count(*) INTO i_ns_d, i_ns_m
  FROM public.meeting_slot_attendees msa
  JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
  JOIN public.closers c ON c.id = ms.closer_id
  WHERE ms.meeting_type = 'r1' AND COALESCE(msa.is_partner,false) = false AND msa.status = 'no_show'
    AND COALESCE(c.bu,'incorporador') = 'incorporador'
    AND ms.scheduled_at >= v_t0m AND ms.scheduled_at < v_t1;

  SELECT count(DISTINCT COALESCE(ce.deal_id, ce.attendee_id)) INTO i_cp_m
  FROM public.caucoes_efetivas(v_ini, p_data, 'incorporador') ce
  WHERE ce.refunded_at IS NULL AND ce.closer_id IS NOT NULL;

  SELECT count(*) FILTER (WHERE msa.status NOT IN ('cancelled','rescheduled')),
         count(*) FILTER (WHERE msa.status IN ('completed','contract_paid','refunded'))
    INTO i_r2ag_m, i_r2re_m
  FROM public.meeting_slot_attendees msa JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
  WHERE ms.meeting_type = 'r2' AND COALESCE(msa.is_partner,false) = false
    AND ms.scheduled_at >= v_t0m AND ms.scheduled_at < v_t1;

  SELECT count(*) INTO i_vd_m FROM public.deal_activities da
  WHERE da.to_stage = 'Venda realizada' AND da.created_at >= v_t0m AND da.created_at < v_t1;

  SELECT COALESCE(sum(t.net_value),0) INTO i_fat_m
  FROM public.get_hubla_transactions_by_bu('incorporador', NULL,
         v_ini::text || 'T00:00:00-03:00', p_data::text || 'T23:59:59.999-03:00', 1000000) t
  WHERE COALESCE(btrim(t.customer_email),'') <> ''
    AND (COALESCE(t.net_value,0) > 0 OR COALESCE(t.product_price,0) > 0);

  SELECT * INTO meta_inc FROM public.incorporador_bi_metas WHERE month_ref = v_ini LIMIT 1;

  -- ═══ 2. CONSÓRCIO ═══
  SELECT jsonb_object_agg(r.metrica, r.valor) INTO d_con FROM public.relatorio_diario_bu(p_data) r WHERE r.bu = 'consorcio';
  SELECT count(*) FILTER (WHERE f.fato = 'agendada'), count(*) FILTER (WHERE f.fato = 'realizada'),
         count(*) FILTER (WHERE f.fato = 'no_show')
    INTO c_ag_m, c_re_m, c_ns_m
  FROM public.get_agenda_fatos_consorcio(v_ini::text, p_data::text) f;
  SELECT count(*) FILTER (WHERE f.fato = 'no_show') INTO c_ns_d
  FROM public.get_agenda_fatos_consorcio(p_data::text, p_data::text) f;
  SELECT COALESCE((public.consorcio_producao_gerada(v_ini, p_data, 'consorcio') -> 'total' ->> 'credito')::numeric, 0) INTO c_prod_m;
  SELECT count(*), count(DISTINCT public.consorcio_chave_cliente(c.cpf, c.cnpj, c.nome_completo, c.id)), COALESCE(sum(c.valor_credito),0)
    INTO c_cotas_m, c_vend_m, c_valor_m
  FROM public.consortium_cards c
  WHERE c.tipo_registro = 'contratacao' AND c.data_contratacao BETWEEN v_ini AND p_data;
  SELECT * INTO meta_con FROM public.consorcio_bi_metas WHERE month_ref = v_ini LIMIT 1;

  -- ═══ 3. SOLAR (reaproveita painel_comercial_solar) ═══
  s_d := public.painel_comercial_solar(p_data, p_data) -> 'totais';
  s_m := public.painel_comercial_solar(v_ini, p_data) -> 'totais';
  SELECT * INTO meta_sol FROM public.solar_bi_metas WHERE month_ref = v_ini LIMIT 1;

  -- ═══ 4. CRÉDITO (reaproveita painel_comercial_credito + esteira) ═══
  cr_d := public.painel_comercial_credito(p_data, p_data) -> 'totais';
  cr_m := public.painel_comercial_credito(v_ini, p_data) -> 'totais';
  WITH acoes(acao) AS (VALUES ('aguardando_documentacao'),('documentacao_pendente'),('documentacao_ok'),
                              ('grupo_aberto'),('analise_credito'),('credito_aprovado'),('credito_reprovado')),
  ev AS (
    SELECT da.metadata->>'acao' AS acao, da.created_at FROM public.deal_activities da
    JOIN public.crm_deals d ON d.id = da.deal_id
    WHERE da.activity_type = 'credito_esteira' AND d.origin_id = 'c4ed1700-0000-4000-8000-000000000002'
      AND da.created_at >= v_t0m AND da.created_at < v_t1
  )
  SELECT jsonb_object_agg(a.acao, public._rdo_m(
           (SELECT count(*) FROM ev WHERE ev.acao = a.acao AND ev.created_at >= v_t0d),
           (SELECT count(*) FROM ev WHERE ev.acao = a.acao), NULL, 'aditivo',
           'passos registrados pelos botões da esteira (deal_activities.credito_esteira); meta não existe'))
    INTO cr_est_d FROM acoes a;

  -- ═══ 5. GERENTES DE RELACIONAMENTO ═══
  SELECT count(*) FILTER (WHERE e.created_at >= v_t0d), count(*) INTO gr_d, gr_m
  FROM public.crm_externo_encaminhamentos e WHERE e.created_at >= v_t0m AND e.created_at < v_t1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('gerente', g.nome, 'email', g.email, 'dia', g.dia, 'mes', g.mes) ORDER BY g.mes DESC, g.nome), '[]'::jsonb)
    INTO gr_lista
  FROM (SELECT COALESCE(NULLIF(btrim(e.gerente_nome),''), '(sem gerente no payload)') AS nome, max(e.gerente_email) AS email,
               count(*) FILTER (WHERE e.created_at >= v_t0d) AS dia, count(*) AS mes
        FROM public.crm_externo_encaminhamentos e WHERE e.created_at >= v_t0m AND e.created_at < v_t1
        GROUP BY 1) g;

  -- ═══ 6. COBRANÇA INCORPORADOR (À Receber) ═══
  SELECT jsonb_build_object(
    'parcelas_pagas_qtd', public._rdo_m(
        (SELECT count(*) FROM ar_parcelas WHERE data_pagamento = p_data),
        (SELECT count(*) FROM ar_parcelas WHERE data_pagamento BETWEEN v_ini AND p_data), NULL, 'aditivo', 'ar_parcelas.data_pagamento; meta não existe'),
    'parcelas_pagas_valor', public._rdo_m(
        (SELECT COALESCE(sum(valor_pago),0) FROM ar_parcelas WHERE data_pagamento = p_data),
        (SELECT COALESCE(sum(valor_pago),0) FROM ar_parcelas WHERE data_pagamento BETWEEN v_ini AND p_data), NULL, 'aditivo', 'ar_parcelas.valor_pago; meta não existe'),
    'vencido_em_aberto_qtd', public._rdo_m(
        (SELECT count(*) FROM ar_parcelas p JOIN ar_titulos t ON t.id = p.titulo_id
          WHERE p.data_vencimento < p_data AND p.status <> 'cancelado' AND t.status NOT IN ('cancelado','reembolsado')
            AND (p.data_pagamento IS NULL OR p.data_pagamento >= p_data)), NULL, NULL, 'nao_somavel',
        'estoque na data (vencimento antes da data e sem pagamento até a data); mes = null porque estoque não acumula'),
    'vencido_em_aberto_valor', public._rdo_m(
        (SELECT COALESCE(sum(p.valor),0) FROM ar_parcelas p JOIN ar_titulos t ON t.id = p.titulo_id
          WHERE p.data_vencimento < p_data AND p.status <> 'cancelado' AND t.status NOT IN ('cancelado','reembolsado')
            AND (p.data_pagamento IS NULL OR p.data_pagamento >= p_data)), NULL, NULL, 'nao_somavel',
        'estoque na data; mes = null porque estoque não acumula'),
    'contatos_cobranca', public._rdo_m(
        (SELECT count(*) FROM ar_historico WHERE tipo = 'contato_cobranca' AND created_at >= v_t0d AND created_at < v_t1),
        (SELECT count(*) FROM ar_historico WHERE tipo = 'contato_cobranca' AND created_at >= v_t0m AND created_at < v_t1), NULL, 'aditivo',
        'ar_historico tipo contato_cobranca; meta não existe')
  ) INTO ci;

  -- ═══ 7. COBRANÇA CONSÓRCIO ═══
  SELECT jsonb_build_object(
    'parcelas_pagas_qtd', public._rdo_m(
        (SELECT count(*) FROM consortium_installments WHERE data_pagamento = p_data),
        (SELECT count(*) FROM consortium_installments WHERE data_pagamento BETWEEN v_ini AND p_data), NULL, 'aditivo', 'consortium_installments.data_pagamento; meta não existe'),
    'parcelas_pagas_valor', public._rdo_m(
        (SELECT COALESCE(sum(valor_parcela),0) FROM consortium_installments WHERE data_pagamento = p_data),
        (SELECT COALESCE(sum(valor_parcela),0) FROM consortium_installments WHERE data_pagamento BETWEEN v_ini AND p_data), NULL, 'aditivo', 'consortium_installments.valor_parcela; meta não existe'),
    'vencido_em_aberto_qtd', public._rdo_m(
        (SELECT count(*) FROM consortium_installments WHERE data_vencimento < p_data
           AND (status IN ('pendente','atrasado') OR (status = 'pago' AND data_pagamento >= p_data))), NULL, NULL, 'nao_somavel',
        'estoque na data (status pendente/atrasado; previsto fora); mes = null porque estoque não acumula'),
    'vencido_em_aberto_valor', public._rdo_m(
        (SELECT COALESCE(sum(valor_parcela),0) FROM consortium_installments WHERE data_vencimento < p_data
           AND (status IN ('pendente','atrasado') OR (status = 'pago' AND data_pagamento >= p_data))), NULL, NULL, 'nao_somavel',
        'estoque na data; mes = null porque estoque não acumula'),
    'alteracoes_status_cobranca', public._rdo_m(
        (SELECT count(*) FROM consortium_installments WHERE cobranca_status_updated_at >= v_t0d AND cobranca_status_updated_at < v_t1),
        (SELECT count(*) FROM consortium_installments WHERE cobranca_status_updated_at >= v_t0m AND cobranca_status_updated_at < v_t1), NULL, 'nao_somavel',
        'só a ÚLTIMA alteração de cada parcela fica gravada (sem histórico): mudanças anteriores no mesmo mês se perdem'),
    'alteracoes_status_cobranca_por_status', COALESCE((
        SELECT jsonb_object_agg(COALESCE(cobranca_status,'(vazio)'), n) FROM (
          SELECT cobranca_status, count(*) n FROM consortium_installments
          WHERE cobranca_status_updated_at >= v_t0d AND cobranca_status_updated_at < v_t1 GROUP BY 1) x), '{}'::jsonb),
    'acoes_cobranca', public._rdo_m(
        (SELECT count(*) FROM cobranca_acoes WHERE created_at >= v_t0d AND created_at < v_t1),
        (SELECT count(*) FROM cobranca_acoes WHERE created_at >= v_t0m AND created_at < v_t1), NULL, 'aditivo',
        'cobranca_acoes; meta não existe')
  ) INTO cc;

  RETURN jsonb_build_object(
    'cabecalho', jsonb_build_object('data', p_data, 'mes_de', v_ini, 'mes_ate', p_data,
                                    'gerado_em', now(), 'fuso', 'America/Sao_Paulo', 'versao', 1),
    'incorporador', jsonb_build_object(
      'meta_mes', CASE WHEN meta_inc IS NULL THEN NULL ELSE to_jsonb(meta_inc) END,
      'observacao_meta', CASE WHEN meta_inc IS NULL THEN 'sem linha em incorporador_bi_metas para o mês' END,
      'metricas', jsonb_build_object(
        'r1_agendadas',   public._rdo_m((d_inc->>'r01_agendada')::numeric, i_r1ag_m, NULL, 'nao_somavel', 'meta de reuniões não existe'),
        'r1_realizadas',  public._rdo_m((d_inc->>'r01_realizada')::numeric, i_r1re_m, NULL, 'nao_somavel', 'meta de reuniões não existe'),
        'r1_no_show',     public._rdo_m(i_ns_d, i_ns_m, NULL, 'aditivo', 'linha de participante R1 status no_show, closer incorporador, parceiro fora; meta não existe'),
        'r2_agendadas',   public._rdo_m((d_inc->>'r02_agendada')::numeric, i_r2ag_m, NULL, 'aditivo', 'meta não existe'),
        'r2_realizadas',  public._rdo_m((d_inc->>'r02_realizada')::numeric, i_r2re_m, NULL, 'aditivo', 'meta não existe'),
        'contratos_pagos', public._rdo_m((d_inc->>'contrato_pago')::numeric, i_cp_m, NULL, 'nao_somavel', 'caucoes_efetivas sem reembolso; meta não existe'),
        'vendas_realizadas', public._rdo_m((d_inc->>'venda_realizada')::numeric, i_vd_m, NULL, 'aditivo', 'meta não existe'),
        'faturamento_liquido', public._rdo_m((d_inc->>'faturamento_liquido')::numeric, i_fat_m, meta_inc.meta_valor, 'aditivo',
            CASE WHEN meta_inc IS NULL THEN 'meta: sem linha em incorporador_bi_metas para o mês' END)
      )),
    'consorcio', jsonb_build_object(
      'meta_mes', CASE WHEN meta_con IS NULL THEN NULL ELSE jsonb_build_object('meta_valor', meta_con.meta_valor, 'meta_agendamento_dia', meta_con.meta_agendamento_dia) END,
      'observacao_meta', CASE WHEN meta_con IS NULL THEN 'sem linha em consorcio_bi_metas para o mês'
                              ELSE 'meta_valor é meta monetária do mês sem métrica única associada; meta_agendamento_dia é meta por dia' END,
      'metricas', jsonb_build_object(
        'reunioes_agendadas', public._rdo_m((d_con->>'reuniao_agendada')::numeric, c_ag_m, meta_con.meta_agendamento_dia, 'nao_somavel',
            CASE WHEN meta_con IS NULL THEN 'meta: sem linha em consorcio_bi_metas' ELSE 'meta = meta_agendamento_dia (por dia)' END),
        'reunioes_realizadas', public._rdo_m((d_con->>'reuniao_realizada')::numeric, c_re_m, NULL, 'nao_somavel', 'meta não existe'),
        'no_show', public._rdo_m(c_ns_d, c_ns_m, NULL, 'nao_somavel', 'get_agenda_fatos_consorcio fato no_show; meta não existe'),
        'producao_gerada', public._rdo_m((d_con->>'producao_gerada')::numeric, c_prod_m, NULL, 'aditivo', NULL),
        'cotas_contratadas', public._rdo_m((d_con->>'cotas_contratadas')::numeric, c_cotas_m, NULL, 'aditivo', NULL),
        'vendas_realizadas', public._rdo_m((d_con->>'venda_realizada')::numeric, c_vend_m, NULL, 'nao_somavel', 'clientes distintos'),
        'valor_efetivado', public._rdo_m((d_con->>'consorcios_efetivados')::numeric, c_valor_m, NULL, 'aditivo', NULL)
      )),
    'solar', jsonb_build_object(
      'meta_mes', CASE WHEN meta_sol IS NULL THEN NULL ELSE jsonb_build_object('meta_valor', meta_sol.meta_valor, 'meta_agendamento_dia', meta_sol.meta_agendamento_dia) END,
      'observacao_meta', CASE WHEN meta_sol IS NULL THEN 'sem linha em solar_bi_metas para o mês' END,
      'fonte', 'painel_comercial_solar',
      'metricas', jsonb_build_object(
        'agendamentos_criados', public._rdo_m((s_d->>'agendamentos')::numeric, (s_m->>'agendamentos')::numeric, NULL, 'aditivo', NULL),
        'reunioes_agendadas', public._rdo_m((s_d->>'agendadas')::numeric, (s_m->>'agendadas')::numeric, meta_sol.meta_agendamento_dia, 'aditivo', NULL),
        'reunioes_realizadas', public._rdo_m((s_d->>'realizadas')::numeric, (s_m->>'realizadas')::numeric, NULL, 'aditivo', NULL),
        'no_show', public._rdo_m((s_d->>'no_show')::numeric, (s_m->>'no_show')::numeric, NULL, 'aditivo', NULL),
        'pendentes', public._rdo_m((s_d->>'pendentes_futuras')::numeric + (s_d->>'pendentes_vencidas')::numeric,
                                   (s_m->>'pendentes_futuras')::numeric + (s_m->>'pendentes_vencidas')::numeric, NULL, 'aditivo', 'status invited (futuras + vencidas)'),
        'vendas', public._rdo_m((s_d->>'vendas')::numeric, (s_m->>'vendas')::numeric, NULL, 'nao_somavel', 'primeira entrada na etapa "Venda realizada" no período'),
        'contrato_pago', public._rdo_m((s_d->>'contratos_pagos')::numeric, (s_m->>'contratos_pagos')::numeric, NULL, 'nao_somavel', 'etapa "Contrato Pago", nunca somada à venda')
      )),
    'credito', jsonb_build_object(
      'meta_mes', NULL, 'observacao_meta', 'não existe tabela de metas do Crédito',
      'fonte', 'painel_comercial_credito + deal_activities.credito_esteira',
      'metricas', jsonb_build_object(
        'leads_criados', public._rdo_m((cr_d->>'leads_criados')::numeric, (cr_m->>'leads_criados')::numeric, NULL, 'aditivo', 'meta não existe'),
        'r1_agendadas', public._rdo_m((cr_d->>'agendadas')::numeric, (cr_m->>'agendadas')::numeric, NULL, 'aditivo', 'meta não existe'),
        'r1_realizadas', public._rdo_m((cr_d->>'realizadas')::numeric, (cr_m->>'realizadas')::numeric, NULL, 'aditivo', 'meta não existe'),
        'r1_no_show', public._rdo_m((cr_d->>'no_show')::numeric, (cr_m->>'no_show')::numeric, NULL, 'aditivo', 'meta não existe'),
        'vendas_credito', public._rdo_m((cr_d->>'vendas')::numeric, (cr_m->>'vendas')::numeric, NULL, 'aditivo', 'credito_vendas pela data de assinatura; meta não existe'),
        'volume_financiado', public._rdo_m((cr_d->>'volume_financiado')::numeric, (cr_m->>'volume_financiado')::numeric, NULL, 'aditivo', 'meta não existe')
      ),
      'esteira', cr_est_d),
    'gerentes_relacionamento', jsonb_build_object(
      'meta_mes', NULL, 'observacao_meta', SEM,
      'metricas', jsonb_build_object(
        'encaminhamentos', public._rdo_m(gr_d, gr_m, NULL, 'aditivo', 'crm_externo_encaminhamentos.created_at; meta não existe'),
        'carteira', public._rdo_m(NULL, NULL, NULL, 'nao_somavel', SEM),
        'atendimentos', public._rdo_m(NULL, NULL, NULL, 'aditivo', SEM),
        'cotas_acompanhadas', public._rdo_m(NULL, NULL, NULL, 'nao_somavel', SEM),
        'renegociacoes', public._rdo_m(NULL, NULL, NULL, 'aditivo', SEM)
      ),
      'por_gerente', gr_lista),
    'cobranca_incorporador', jsonb_build_object('meta_mes', NULL, 'observacao_meta', 'não existe meta de cobrança', 'fonte', 'ar_titulos / ar_parcelas / ar_historico', 'metricas', ci),
    'cobranca_consorcio', jsonb_build_object('meta_mes', NULL, 'observacao_meta', 'não existe meta de cobrança', 'fonte', 'consortium_installments / cobranca_acoes', 'metricas', cc)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.relatorio_diario_operacoes(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_diario_operacoes(date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gravar_snapshot_relatorio_diario(p_data date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  j jsonb := public.relatorio_diario_operacoes(p_data);
  n integer;
BEGIN
  INSERT INTO public.relatorio_diario_snapshots (data, bu, metrica, valor, status, gerado_em, revisao)
  SELECT p_data, s.key, mm.key,
         NULLIF(mm.value->>'dia','')::numeric,
         CASE WHEN mm.value->>'dia' IS NULL THEN 'sem_fonte' ELSE 'ok' END,
         now(), 1
  FROM jsonb_each(j - 'cabecalho') s
  CROSS JOIN LATERAL jsonb_each(s.value->'metricas') mm
  WHERE jsonb_typeof(mm.value) = 'object' AND mm.value ? 'agregacao'
  UNION ALL
  SELECT p_data, 'credito', 'esteira_' || e.key, NULLIF(e.value->>'dia','')::numeric, 'ok', now(), 1
  FROM jsonb_each(j->'credito'->'esteira') e
  ON CONFLICT (data, bu, metrica) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;
REVOKE ALL ON FUNCTION public.gravar_snapshot_relatorio_diario(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gravar_snapshot_relatorio_diario(date) TO service_role;

SELECT cron.schedule(
  'relatorio-diario-operacoes-snapshot',
  '15 11 * * *',
  $$SELECT public.gravar_snapshot_relatorio_diario(((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1));$$
);