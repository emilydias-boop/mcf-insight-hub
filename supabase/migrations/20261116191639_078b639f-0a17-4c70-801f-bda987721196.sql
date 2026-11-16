CREATE OR REPLACE FUNCTION public.resumo_app()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_nome text;
  v_squad text[];
  v_status text;
  v_bloq timestamptz;
  v_roles text[];
  v_lider boolean;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_bus jsonb := '[]'::jsonb;
  v_bu text;
  v_titulo text;
  v_closer_ids uuid[];
  v_closer_keys text[];
  v_is_sdr boolean;
  v_papel text;
  v_periodos jsonb;
  v_per record;
  v_m jsonb;
  g_agm numeric; g_ag numeric; g_rz numeric; g_ns numeric; g_ct numeric; g_val numeric;
  m_agm numeric; m_ag numeric; m_rz numeric; m_ns numeric; m_ct numeric; m_val numeric;
  s json; v_ct_closer numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT NULLIF(lower(btrim(p.email)), ''), p.full_name, p.squad, p.access_status, p.blocked_until
    INTO v_email, v_nome, v_squad, v_status, v_bloq
  FROM profiles p WHERE p.id = v_uid;

  IF COALESCE(v_status, 'ativo') <> 'ativo' OR (v_bloq IS NOT NULL AND v_bloq > now()) THEN
    RAISE EXCEPTION 'acesso_bloqueado' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(ur.role::text), '{}') INTO v_roles
  FROM user_roles ur WHERE ur.user_id = v_uid;

  IF NOT (v_roles && ARRAY['admin','manager','coordenador','sdr','closer','closer_sombra']) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;
  v_lider := v_roles && ARRAY['admin','manager','coordenador'];

  FOREACH v_bu IN ARRAY ARRAY['consorcio','incorporador'] LOOP
    v_titulo := CASE v_bu WHEN 'consorcio' THEN 'Consórcio' ELSE 'Incorporador MCF' END;

    SELECT COALESCE(array_agg(DISTINCT c.id), '{}')
      INTO v_closer_ids
    FROM closers c
    LEFT JOIN employees e ON e.id = c.employee_id
    WHERE c.bu = v_bu
      AND (e.user_id = v_uid OR (v_email IS NOT NULL AND lower(btrim(c.email)) = v_email));

    SELECT COALESCE(array_agg(k.chave), '{}') INTO v_closer_keys
    FROM (
      SELECT public.consorcio_name_key(c.name) AS chave
      FROM closers c
      WHERE c.bu = v_bu AND c.name IS NOT NULL
      GROUP BY 1
      HAVING bool_and(c.id = ANY (v_closer_ids))
         AND public.consorcio_name_key(min(c.name)) IS NOT NULL
         AND public.consorcio_name_key(min(c.name)) <> ''
    ) k
    WHERE cardinality(v_closer_ids) > 0;

    v_is_sdr := v_email IS NOT NULL AND (
      EXISTS (SELECT 1 FROM sdr s
              WHERE lower(btrim(s.email)) = v_email AND s.active AND s.squad = v_bu)
      OR ('sdr' = ANY (v_roles) AND v_bu = ANY (COALESCE(v_squad, '{}'))));

    v_papel := CASE
      WHEN cardinality(v_closer_ids) > 0 THEN 'closer'
      WHEN v_is_sdr THEN 'sdr'
      ELSE NULL END;

    IF NOT (
      v_bu = ANY (COALESCE(v_squad, '{}'))
      OR v_papel IS NOT NULL
      OR (v_lider AND cardinality(COALESCE(v_squad, '{}')) = 0)
    ) THEN
      CONTINUE;
    END IF;

    v_periodos := '[]'::jsonb;
    FOR v_per IN
      SELECT * FROM (VALUES
        ('hoje',   'Hoje',   v_hoje, v_hoje, 1),
        ('semana', 'Semana',
           CASE v_bu WHEN 'consorcio'
             THEN v_hoje - (EXTRACT(isodow FROM v_hoje)::int - 1)
             ELSE v_hoje - ((EXTRACT(dow FROM v_hoje)::int + 1) % 7) END,
           CASE v_bu WHEN 'consorcio'
             THEN v_hoje - (EXTRACT(isodow FROM v_hoje)::int - 1) + 6
             ELSE v_hoje - ((EXTRACT(dow FROM v_hoje)::int + 1) % 7) + 6 END, 2),
        ('mes',    'Mês',    date_trunc('month', v_hoje)::date,
                             (date_trunc('month', v_hoje) + interval '1 month - 1 day')::date, 3)
      ) AS t(chave, rotulo, ini, fim, ordem)
      ORDER BY ordem
    LOOP
      IF v_bu = 'consorcio' THEN
        SELECT
          count(*) FILTER (WHERE f.fato = 'agendamento'),
          count(*) FILTER (WHERE f.fato = 'agendada'),
          count(*) FILTER (WHERE f.fato = 'realizada'),
          count(*) FILTER (WHERE f.fato = 'no_show'),
          count(*) FILTER (WHERE f.fato = 'agendamento' AND v_papel = 'sdr' AND f.sdr_email = v_email),
          count(*) FILTER (WHERE f.fato = 'agendada' AND (
              (v_papel = 'sdr' AND f.sdr_email = v_email) OR (v_papel = 'closer' AND f.closer_id = ANY (v_closer_ids)))),
          count(*) FILTER (WHERE f.fato = 'realizada' AND (
              (v_papel = 'sdr' AND f.sdr_email = v_email) OR (v_papel = 'closer' AND f.closer_id = ANY (v_closer_ids)))),
          count(*) FILTER (WHERE f.fato = 'no_show' AND (
              (v_papel = 'sdr' AND f.sdr_email = v_email) OR (v_papel = 'closer' AND f.closer_id = ANY (v_closer_ids))))
        INTO g_agm, g_ag, g_rz, g_ns, m_agm, m_ag, m_rz, m_ns
        FROM public.get_agenda_fatos_consorcio(v_per.ini::text, v_per.fim::text) f;

        SELECT count(*), COALESCE(sum(c.valor_credito), 0),
               count(*) FILTER (WHERE public.consorcio_name_key(c.vendedor_name) = ANY (v_closer_keys)),
               COALESCE(sum(c.valor_credito) FILTER (WHERE public.consorcio_name_key(c.vendedor_name) = ANY (v_closer_keys)), 0)
          INTO g_ct, g_val, m_ct, m_val
        FROM consortium_cards c
        WHERE c.tipo_registro = 'contratacao'
          AND c.data_contratacao BETWEEN v_per.ini AND v_per.fim;

        v_m := jsonb_build_array(
          jsonb_build_object('chave','agendamentos','rotulo','Agendamentos','formato','int',
            'global', g_agm, 'meu', CASE WHEN v_papel = 'sdr' THEN m_agm END,
            'ajuda','R1 marcadas no período (data em que foi agendada).'),
          jsonb_build_object('chave','r1_agendada','rotulo','R1 agendadas','formato','int',
            'global', g_ag, 'meu', CASE WHEN v_papel IS NOT NULL THEN m_ag END,
            'ajuda','Reuniões R1 com data no período (Painel Comercial do Consórcio).'),
          jsonb_build_object('chave','r1_realizada','rotulo','R1 realizadas','formato','int',
            'global', g_rz, 'meu', CASE WHEN v_papel IS NOT NULL THEN m_rz END),
          jsonb_build_object('chave','no_show','rotulo','No-show','formato','int',
            'global', g_ns, 'meu', CASE WHEN v_papel IS NOT NULL THEN m_ns END),
          jsonb_build_object('chave','cotas_contratadas','rotulo','Cotas contratadas','formato','int',
            'global', g_ct, 'meu', CASE WHEN v_papel = 'closer' THEN m_ct END,
            'ajuda','Cotas com data de contratação no período. Do closer: pelo nome do vendedor na cota.'),
          jsonb_build_object('chave','credito_contratado','rotulo','Crédito contratado','formato','brl',
            'global', g_val, 'meu', CASE WHEN v_papel = 'closer' THEN m_val END)
        );

      ELSE
        SELECT count(*),
               count(*) FILTER (WHERE msa.status IN ('completed','contract_paid','refunded')),
               count(*) FILTER (WHERE msa.status = 'no_show')
          INTO g_ag, g_rz, g_ns
        FROM meeting_slot_attendees msa
        JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
        JOIN closers c ON c.id = ms.closer_id
        WHERE ms.meeting_type = 'r1'
          AND ms.status IS NOT NULL AND ms.status NOT IN ('cancelled','canceled')
          AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_per.ini AND v_per.fim
          AND msa.is_partner IS NOT TRUE
          AND msa.deal_id IS NOT NULL
          AND msa.status IN ('scheduled','invited','completed','no_show','contract_paid','refunded','rescheduled')
          AND c.bu = 'incorporador' AND c.is_active = true;

        SELECT COALESCE(sum(n), 0) INTO g_agm FROM (
          SELECT CASE WHEN x.deal_id IS NULL THEN count(*) ELSE LEAST(count(DISTINCT x.dia), 2) END AS n
          FROM (
            SELECT ms.closer_id, msa.deal_id, msa.id,
                   (msa.booked_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia
            FROM meeting_slot_attendees msa
            JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
            JOIN closers c ON c.id = ms.closer_id
            WHERE ms.meeting_type = 'r1'
              AND COALESCE(ms.status, '') NOT IN ('cancelled','canceled')
              AND msa.is_partner = false
              AND msa.booked_at IS NOT NULL
              AND msa.status IN ('scheduled','invited','completed','no_show','contract_paid','refunded','rescheduled')
              AND c.bu = 'incorporador' AND c.is_active = true
              AND (msa.booked_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_per.ini AND v_per.fim
          ) x
          GROUP BY x.closer_id, x.deal_id, CASE WHEN x.deal_id IS NULL THEN x.id END
        ) y;

        WITH ativos AS (
          SELECT id FROM closers WHERE bu = 'incorporador' AND is_active = true
        ), ce AS (
          SELECT closer_id FROM public.caucoes_efetivas(v_per.ini, v_per.fim, 'incorporador')
        ), man AS (
          SELECT m.closer_id FROM manual_sale_attributions m
          WHERE m.business_unit = 'incorporador'
            AND (m.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_per.ini AND v_per.fim
        )
        SELECT
          (SELECT count(*) FROM ce WHERE closer_id IN (SELECT id FROM ativos))
        + (SELECT count(*) FROM man WHERE closer_id IN (SELECT id FROM ativos))
        + (SELECT count(*) FROM ce WHERE closer_id IS NULL)
        + (SELECT count(*) FROM public.caucoes_orfas(v_per.ini, v_per.fim)),
          (SELECT count(*) FROM ce WHERE closer_id = ANY (v_closer_ids) AND closer_id IN (SELECT id FROM ativos))
        + (SELECT count(*) FROM man WHERE closer_id = ANY (v_closer_ids) AND closer_id IN (SELECT id FROM ativos))
        INTO g_ct, v_ct_closer;

        m_agm := NULL; m_ag := NULL; m_rz := NULL; m_ns := NULL; m_ct := NULL;
        IF v_papel = 'sdr' THEN
          s := public.get_sdr_metrics_from_agenda(v_per.ini::text, v_per.fim::text, v_email, 'incorporador', NULL);
          SELECT COALESCE(sum((e->>'agendamentos')::numeric), 0), COALESCE(sum((e->>'r1_agendada')::numeric), 0),
                 COALESCE(sum((e->>'r1_realizada')::numeric), 0), COALESCE(sum((e->>'no_shows')::numeric), 0),
                 COALESCE(sum((e->>'contratos')::numeric), 0)
            INTO m_agm, m_ag, m_rz, m_ns, m_ct
          FROM json_array_elements(s->'metrics') e;
        ELSIF v_papel = 'closer' THEN
          SELECT count(*),
                 count(*) FILTER (WHERE msa.status IN ('completed','contract_paid','refunded')),
                 count(*) FILTER (WHERE msa.status = 'no_show')
            INTO m_ag, m_rz, m_ns
          FROM meeting_slot_attendees msa
          JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
          JOIN closers c ON c.id = ms.closer_id AND c.is_active = true
          WHERE ms.meeting_type = 'r1'
            AND ms.closer_id = ANY (v_closer_ids)
            AND ms.status IS NOT NULL AND ms.status NOT IN ('cancelled','canceled')
            AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_per.ini AND v_per.fim
            AND msa.is_partner IS NOT TRUE
            AND msa.deal_id IS NOT NULL
            AND msa.status IN ('scheduled','invited','completed','no_show','contract_paid','refunded','rescheduled');

          m_ct := v_ct_closer;
        END IF;

        v_m := jsonb_build_array(
          jsonb_build_object('chave','agendamentos','rotulo','Agendamentos','formato','int',
            'global', g_agm, 'meu', CASE WHEN v_papel = 'sdr' THEN m_agm END,
            'ajuda','R1 marcadas no período (data em que foi agendada).'),
          jsonb_build_object('chave','r1_agendada','rotulo','R1 agendadas','formato','int',
            'global', g_ag, 'meu', m_ag,
            'ajuda','Equipe e closer: contagem da Agenda R1. SDR: régua da tabela de SDRs (até 2 por negócio).'),
          jsonb_build_object('chave','r1_realizada','rotulo','R1 realizadas','formato','int',
            'global', g_rz, 'meu', m_rz),
          jsonb_build_object('chave','no_show','rotulo','No-show','formato','int',
            'global', g_ns, 'meu', m_ns),
          jsonb_build_object('chave','contratos','rotulo','Contratos pagos','formato','int',
            'global', g_ct, 'meu', m_ct,
            'ajuda','Equipe: card Contratos do Painel (inclui reembolsados). SDR: líquido, como na tabela de SDRs.')
        );
      END IF;

      v_periodos := v_periodos || jsonb_build_object(
        'periodo', v_per.chave, 'rotulo', v_per.rotulo,
        'ini', v_per.ini, 'fim', v_per.fim, 'metricas', v_m);
    END LOOP;

    v_bus := v_bus || jsonb_build_object('bu', v_bu, 'titulo', v_titulo, 'papel', v_papel, 'periodos', v_periodos);
  END LOOP;

  RETURN jsonb_build_object(
    'gerado_em', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"'),
    'nome', v_nome,
    'bus', v_bus
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.resumo_app() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_app() TO authenticated;

COMMENT ON FUNCTION public.resumo_app() IS
  'App MCF Resumo (iPhone): números globais da BU + números da própria pessoa (auth.uid()). Só leitura.';