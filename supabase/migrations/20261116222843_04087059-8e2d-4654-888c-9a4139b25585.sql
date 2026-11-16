-- =====================================================================
-- resumo_app_v2(p_preset, p_ini, p_fim): números do app "MCF Gestão" (iPhone).
-- Só leitura: nenhum INSERT/UPDATE/DELETE, nenhum gatilho, nenhum webhook.
--
-- Uma chamada = um período. Para cada BU da pessoa devolve:
--   - métricas globais da BU + "meu" (só números da própria pessoa);
--   - "pessoas" (tabelas por SDR e por closer) SOMENTE para liderança
--     (admin, manager, coordenador). Para os demais, "pessoas" = null.
-- Identidade só por auth.uid(). Segurança e regras de BU/papel copiadas da v1
-- (Apps/MCF Resumo/Support/resumo_app.sql).
--
-- Réguas (mapa v2map.json + correções dos revisores):
--   Consórcio    -> get_agenda_fatos_consorcio (Painel do Consórcio, /consorcio/painel-equipe,
--                   useConsorcioAgendaFatos.ts); porte SQL de useConsorcioProducaoGerada.ts
--                   (Produção Gerada e Vendas Realizadas); useConsorcioCotasContratadas.ts (cotas).
--   Incorporador -> contagem literal da Agenda R1 (useR1CloserMetrics.ts, card = soma das linhas
--                   de closer em /crm/reunioes-equipe); card Contratos (ReunioesEquipe.tsx +
--                   useUnassignedContracts.ts); Agenda R2 (R2AgendaKPICards.tsx +
--                   useR2MeetingsExtended.ts); vendas A001/A009 da Hubla (relatorio_diario_operacoes,
--                   migration 20261012231822); get_sdr_metrics_from_agenda (tabela de SDRs).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.resumo_app_v2(
  p_preset text DEFAULT 'hoje',
  p_ini date DEFAULT NULL,
  p_fim date DEFAULT NULL
)
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
  v_preset text := lower(btrim(COALESCE(p_preset, 'hoje')));
  v_c_ini date;
  v_c_fim date;
  v_bus jsonb := '[]'::jsonb;
  v_bu text;
  v_titulo text;
  v_closer_ids uuid[];
  v_closer_keys text[];
  v_r2_ids uuid[];
  v_is_sdr boolean;
  v_papel text;
  v_ini date;
  v_fim date;
  v_rotulo text;
  v_live boolean;
  v_r jsonb;          -- resultado do bloco principal da BU
  v_r2 jsonb;         -- R2 (Incorporador)
  v_vendas numeric;   -- vendas Hubla (Incorporador)
  v_sdrm json;        -- get_sdr_metrics_from_agenda (Incorporador), 1 chamada
  v_m_sdr jsonb;      -- "meu" do SDR no Incorporador
  v_tab_sdr jsonb;    -- tabela de SDRs do Incorporador
  v_metricas jsonb;
  v_pessoas jsonb;
BEGIN
  -- ===================================================================
  -- Segurança (igual à v1)
  -- ===================================================================
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

  -- ===================================================================
  -- Período pedido
  -- ===================================================================
  IF v_preset NOT IN ('hoje','semana','mes','custom') THEN
    RAISE EXCEPTION 'preset_invalido' USING ERRCODE = '22023';
  END IF;
  IF v_preset = 'custom' THEN
    IF p_ini IS NULL OR p_fim IS NULL THEN
      RAISE EXCEPTION 'periodo_invalido' USING ERRCODE = '22023';
    END IF;
    v_c_ini := LEAST(p_ini, p_fim);
    v_c_fim := GREATEST(p_ini, p_fim);
    IF (v_c_fim - v_c_ini + 1) > 400 THEN
      RAISE EXCEPTION 'periodo_muito_longo' USING ERRCODE = '22023';
    END IF;
  END IF;

  FOREACH v_bu IN ARRAY ARRAY['consorcio','incorporador'] LOOP
    v_titulo := CASE v_bu WHEN 'consorcio' THEN 'Consórcio' ELSE 'Incorporador MCF' END;

    -- closer(s) da própria pessoa nesta BU (regra da v1 / is_my_closer; ativos e inativos)
    SELECT COALESCE(array_agg(DISTINCT c.id), '{}')
      INTO v_closer_ids
    FROM closers c
    LEFT JOIN employees e ON e.id = c.employee_id
    WHERE c.bu = v_bu
      AND (e.user_id = v_uid OR (v_email IS NOT NULL AND lower(btrim(c.email)) = v_email));

    -- chaves de nome (primeiro|último) que identificam SÓ esta pessoa
    -- (regra da v1: homônimo de outra pessoa tira a chave; a venda/cota não é creditada a ninguém
    -- no "meu"). Mais estrita que a v1: o homônimo pode ser closer de QUALQUER BU ou SDR com outro
    -- e-mail. A chave precisa ser de um closer da própria pessoa NESTA BU. COALESCE evita que
    -- e-mail nulo vire NULL e seja ignorado pelo bool_and.
    SELECT COALESCE(array_agg(k.chave), '{}') INTO v_closer_keys
    FROM (
      SELECT x.chave
      FROM (
        SELECT public.consorcio_name_key(c.name) AS chave,
               COALESCE(c.id = ANY (v_closer_ids)
                        OR (v_email IS NOT NULL AND lower(btrim(c.email)) = v_email), false) AS minha,
               (c.id = ANY (v_closer_ids)) AS da_bu
        FROM closers c
        WHERE c.name IS NOT NULL
        UNION ALL
        SELECT public.consorcio_name_key(s.name),
               COALESCE(v_email IS NOT NULL AND lower(btrim(s.email)) = v_email, false),
               false
        FROM sdr s
        WHERE s.name IS NOT NULL
      ) x
      WHERE x.chave IS NOT NULL AND x.chave <> ''
      GROUP BY x.chave
      HAVING bool_and(x.minha) AND bool_or(x.da_bu)
    ) k
    WHERE cardinality(v_closer_ids) > 0;

    -- closers de R2 da própria pessoa (só faz sentido no Incorporador)
    SELECT COALESCE(array_agg(c.id), '{}') INTO v_r2_ids
    FROM closers c
    WHERE c.id = ANY (v_closer_ids) AND NULLIF(c.meeting_type::text, '') = 'r2';

    -- SDR da própria pessoa nesta BU (regra da v1: sem e-mail não vira SDR)
    v_is_sdr := v_email IS NOT NULL AND (
      EXISTS (SELECT 1 FROM sdr s
              WHERE lower(btrim(s.email)) = v_email AND s.active AND s.squad = v_bu)
      OR ('sdr' = ANY (v_roles) AND v_bu = ANY (COALESCE(v_squad, '{}'))));

    v_papel := CASE
      WHEN cardinality(v_closer_ids) > 0 THEN 'closer'
      WHEN v_is_sdr THEN 'sdr'
      ELSE NULL END;

    -- a BU entra se a pessoa é dela, ou se é liderança sem BU definida (regra da v1)
    IF NOT (
      v_bu = ANY (COALESCE(v_squad, '{}'))
      OR v_papel IS NOT NULL
      OR (v_lider AND cardinality(COALESCE(v_squad, '{}')) = 0)
    ) THEN
      CONTINUE;
    END IF;

    -- -----------------------------------------------------------------
    -- Período desta BU. Semana: Consórcio segunda a domingo
    -- (CONSORCIO_WEEK_STARTS_ON=1, businessDays.ts); Incorporador sábado a sexta (v1).
    -- -----------------------------------------------------------------
    IF v_preset = 'hoje' THEN
      v_ini := v_hoje; v_fim := v_hoje; v_rotulo := 'Hoje';
    ELSIF v_preset = 'semana' THEN
      IF v_bu = 'consorcio' THEN
        v_ini := v_hoje - (EXTRACT(isodow FROM v_hoje)::int - 1);
      ELSE
        v_ini := v_hoje - ((EXTRACT(dow FROM v_hoje)::int + 1) % 7);
      END IF;
      v_fim := v_ini + 6; v_rotulo := 'Semana';
    ELSIF v_preset = 'mes' THEN
      v_ini := date_trunc('month', v_hoje)::date;
      v_fim := (date_trunc('month', v_hoje) + interval '1 month - 1 day')::date;
      v_rotulo := 'Mês';
    ELSE
      v_ini := v_c_ini; v_fim := v_c_fim; v_rotulo := 'Período';
    END IF;
    -- período "ao vivo" (inclui hoje): useR1CloserMetrics.ts isLivePeriod
    v_live := v_fim >= v_hoje;

    v_pessoas := NULL;

    IF v_bu = 'consorcio' THEN
      -- ===============================================================
      -- CONSÓRCIO: um único comando. Cada fonte roda uma vez.
      -- ===============================================================
      WITH
      -- ---- Agenda: get_agenda_fatos_consorcio (Painel do Consórcio, PainelEquipe.tsx;
      --      migration 20260820025917). Card Agendamentos = todos os fatos 'agendamento'.
      f AS MATERIALIZED (
        SELECT x.fato, NULLIF(lower(btrim(x.sdr_email)), '') AS sdr_email, x.closer_id
        FROM public.get_agenda_fatos_consorcio(v_ini::text, v_fim::text) x
        WHERE x.fato IN ('agendamento','agendada','realizada','no_show')
      ),
      -- ---- Closers da BU e id canônico por e-mail (useConsorcioProducaoGerada.ts:
      --      prefere o ativo, depois o mais antigo)
      closers_bu AS MATERIALIZED (
        SELECT c.id, c.name, NULLIF(lower(btrim(c.email)), '') AS ek, c.is_active, c.created_at
        FROM public.closers c WHERE c.bu = 'consorcio'
      ),
      canon AS MATERIALIZED (
        SELECT DISTINCT ON (cb.ek) cb.ek, cb.id
        FROM closers_bu cb WHERE cb.ek IS NOT NULL
        ORDER BY cb.ek, (cb.is_active IS TRUE) DESC, COALESCE(cb.created_at::text, ''), cb.id
      ),
      id_canon AS MATERIALIZED (
        SELECT cb.id AS raw_id, COALESCE(cn.id, cb.id) AS canon_id
        FROM closers_bu cb LEFT JOIN canon cn ON cn.ek = cb.ek
      ),
      meus_canon AS (
        SELECT DISTINCT ic.canon_id FROM id_canon ic WHERE ic.raw_id = ANY (v_closer_ids)
      ),
      nome_closer AS (
        SELECT DISTINCT ON (x.nk) x.nk, x.closer_id FROM (
          SELECT public.consorcio_name_key(cb.name) AS nk, COALESCE(cn.id, cb.id) AS closer_id,
                 (cb.ek IS NULL) AS sem_email, COALESCE(cb.created_at::text, '') AS ord, cb.id
          FROM closers_bu cb LEFT JOIN canon cn ON cn.ek = cb.ek
          WHERE public.consorcio_name_key(cb.name) IS NOT NULL AND (cb.ek IS NULL OR cn.id = cb.id)
        ) x ORDER BY x.nk, x.sem_email, x.ord, x.id
      ),
      -- ---- Produção Gerada / Vendas Realizadas: porte de useConsorcioProducaoGerada.ts
      --      (pernas A/B/C, cascata de closer com prioridade 0 por origem_attendee_id).
      --      NÃO usa a RPC consorcio_vendas_realizadas (correção 6 do revisor).
      -- Perna A: propostas aceitas
      props AS MATERIALIZED (
        SELECT p.id, p.deal_id, p.created_by, p.origem_attendee_id,
               COALESCE(p.aceite_date, p.proposal_date) AS ancora
        FROM public.consorcio_proposals p
        WHERE p.status = 'aceita' AND p.deleted_at IS NULL AND COALESCE(p.carta_excluida, false) = false
          AND COALESCE(p.aceite_date, p.proposal_date) BETWEEN v_ini AND v_fim
      ),
      cartas_agg AS (
        SELECT k.proposal_id, sum(COALESCE(k.valor_credito, 0)) AS credito
        FROM public.consorcio_proposal_cartas k JOIN props pr ON pr.id = k.proposal_id
        GROUP BY k.proposal_id
      ),
      origem AS MATERIALIZED (
        SELECT msa.id AS attendee_id, ic.canon_id AS closer_id, msa.booked_by
        FROM public.meeting_slot_attendees msa
        LEFT JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
        LEFT JOIN id_canon ic ON ic.raw_id = ms.closer_id
        WHERE msa.id IN (SELECT pr.origem_attendee_id FROM props pr WHERE pr.origem_attendee_id IS NOT NULL)
      ),
      prop_reuniao AS (
        SELECT DISTINCT ON (msa.deal_id) msa.deal_id, ic.canon_id AS closer_id
        FROM public.meeting_slot_attendees msa
        JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
        JOIN id_canon ic ON ic.raw_id = ms.closer_id
        WHERE msa.deal_id IN (SELECT pr.deal_id FROM props pr WHERE pr.deal_id IS NOT NULL)
        ORDER BY msa.deal_id, ms.scheduled_at DESC NULLS LAST
      ),
      -- cliente da proposta: primeiro cadastro (created_at) que tenha documento ou nome
      cad_prop AS (
        SELECT DISTINCT ON (x.proposal_id) x.proposal_id, x.pessoa FROM (
          SELECT r.proposal_id, r.created_at,
            CASE WHEN NULLIF(regexp_replace(COALESCE(r.cpf, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(r.cpf, '\D', '', 'g')
                 WHEN NULLIF(regexp_replace(COALESCE(r.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(r.cnpj, '\D', '', 'g')
                 WHEN public.consorcio_pessoa_nome_key(r.nome_completo) IS NOT NULL THEN 'nome:' || public.consorcio_pessoa_nome_key(r.nome_completo)
            END AS pessoa
          FROM public.consorcio_pending_registrations r JOIN props pr ON pr.id = r.proposal_id
        ) x WHERE x.pessoa IS NOT NULL ORDER BY x.proposal_id, x.created_at
      ),
      perna_a AS (
        SELECT 'A'::text AS perna, pr.ancora,
               COALESCE(o.closer_id, ec1.id, ec2.id, mr.closer_id) AS closer_id,
               ca.credito::numeric AS credito,
               COALESCE(cp.pessoa, 'contato:' || d.contact_id::text, 'deal:' || pr.deal_id::text, 'proposta:' || pr.id::text) AS pessoa,
               pr.deal_id, pr.origem_attendee_id,
               NULL::text AS nk   -- perna A: closer por id, sem chave de nome
        FROM props pr
        JOIN cartas_agg ca ON ca.proposal_id = pr.id
        LEFT JOIN origem o ON o.attendee_id = pr.origem_attendee_id
        LEFT JOIN public.profiles pf ON pf.id = pr.created_by
        LEFT JOIN canon ec1 ON ec1.ek = NULLIF(lower(btrim(pf.email)), '')
        LEFT JOIN public.crm_deals d ON d.id = pr.deal_id
        LEFT JOIN canon ec2 ON ec2.ek = NULLIF(lower(btrim(d.owner_id::text)), '')
        LEFT JOIN prop_reuniao mr ON mr.deal_id = pr.deal_id
        LEFT JOIN cad_prop cp ON cp.proposal_id = pr.id
      ),
      -- Perna C (e base das cotas): consortium_cards de contratação no período
      cards_c AS MATERIALIZED (
        SELECT c.* FROM public.consortium_cards c
        WHERE c.tipo_registro = 'contratacao' AND c.data_contratacao BETWEEN v_ini AND v_fim
      ),
      -- Perna B: cadastros avulsos com aceite no período
      regs AS MATERIALIZED (
        SELECT r.* FROM public.consorcio_pending_registrations r WHERE r.aceite_date BETWEEN v_ini AND v_fim
      ),
      cand_cards AS (
        SELECT rg.consortium_card_id AS cid FROM regs rg WHERE rg.consortium_card_id IS NOT NULL
        UNION SELECT cc.id FROM cards_c cc
      ),
      -- os 4 caminhos de vínculo da cota a proposta (tirar um duplica dinheiro)
      cards_vinc AS MATERIALIZED (
        SELECT cd.cid FROM cand_cards cd
        WHERE EXISTS (SELECT 1 FROM public.consorcio_proposals p WHERE p.consortium_card_id = cd.cid)
           OR EXISTS (SELECT 1 FROM public.consorcio_proposal_cartas k WHERE k.consortium_card_id = cd.cid)
           OR EXISTS (SELECT 1 FROM public.consorcio_pending_registrations r WHERE r.consortium_card_id = cd.cid AND r.proposal_id IS NOT NULL)
           OR EXISTS (SELECT 1 FROM public.consorcio_pending_registrations r
                      JOIN public.consorcio_proposal_cartas k2 ON k2.pending_registration_id = r.id
                      WHERE r.consortium_card_id = cd.cid)
      ),
      perna_b AS (
        SELECT 'B'::text, b.aceite_date, nc.closer_id, COALESCE(b.valor_credito, 0)::numeric,
          CASE WHEN NULLIF(regexp_replace(COALESCE(b.cpf, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(b.cpf, '\D', '', 'g')
               WHEN NULLIF(regexp_replace(COALESCE(b.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(b.cnpj, '\D', '', 'g')
               WHEN public.consorcio_pessoa_nome_key(COALESCE(NULLIF(btrim(b.nome_completo), ''), b.razao_social)) IS NOT NULL
                 THEN 'nome:' || public.consorcio_pessoa_nome_key(COALESCE(NULLIF(btrim(b.nome_completo), ''), b.razao_social))
               ELSE 'card:' || b.id::text END,
          b.deal_id, NULL::uuid,
          public.consorcio_name_key(COALESCE(NULLIF(btrim(b.vendedor_name_cota), ''), b.vendedor_name))
        FROM regs b
        LEFT JOIN nome_closer nc ON nc.nk = public.consorcio_name_key(COALESCE(NULLIF(btrim(b.vendedor_name_cota), ''), b.vendedor_name))
        WHERE b.proposal_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.consorcio_proposal_cartas k WHERE k.pending_registration_id = b.id)
          AND (b.consortium_card_id IS NULL OR b.consortium_card_id NOT IN (SELECT cv.cid FROM cards_vinc cv))
      ),
      perna_c AS (
        SELECT 'C'::text, c.data_contratacao, nc.closer_id, COALESCE(c.valor_credito, 0)::numeric,
          CASE WHEN NULLIF(regexp_replace(COALESCE(c.cpf, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(c.cpf, '\D', '', 'g')
               WHEN NULLIF(regexp_replace(COALESCE(c.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(c.cnpj, '\D', '', 'g')
               WHEN public.consorcio_pessoa_nome_key(c.nome_completo) IS NOT NULL THEN 'nome:' || public.consorcio_pessoa_nome_key(c.nome_completo)
               ELSE 'card:' || c.id::text END,
          NULL::uuid, NULL::uuid,
          public.consorcio_name_key(c.vendedor_name)
        FROM cards_c c
        LEFT JOIN nome_closer nc ON nc.nk = public.consorcio_name_key(c.vendedor_name)
        WHERE NOT EXISTS (SELECT 1 FROM public.consorcio_pending_registrations r WHERE r.consortium_card_id = c.id)
          AND c.id NOT IN (SELECT cv.cid FROM cards_vinc cv)
      ),
      base AS MATERIALIZED (
        SELECT * FROM perna_a UNION ALL SELECT * FROM perna_b UNION ALL SELECT * FROM perna_c
      ),
      -- venda = cliente × mês da âncora; o registro de âncora mais antiga define closer/SDR (empate A<B<C)
      vendas AS MATERIALIZED (
        SELECT DISTINCT ON (b.pessoa, to_char(b.ancora, 'YYYY-MM'))
               b.pessoa, b.ancora, b.perna, b.closer_id, b.deal_id, b.origem_attendee_id, b.nk,
               sum(b.credito) OVER (PARTITION BY b.pessoa, to_char(b.ancora, 'YYYY-MM')) AS credito
        FROM base b ORDER BY b.pessoa, to_char(b.ancora, 'YYYY-MM'), b.ancora, b.perna
      ),
      -- SDR da venda: booker da reunião de origem; senão o último booker elegível do deal
      deal_ultimo_booker AS (
        SELECT DISTINCT ON (msa.deal_id) msa.deal_id, msa.booked_by
        FROM public.meeting_slot_attendees msa
        JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
        JOIN id_canon ic ON ic.raw_id = ms.closer_id
        WHERE msa.deal_id IN (SELECT v.deal_id FROM vendas v WHERE v.deal_id IS NOT NULL)
          AND msa.booked_by IS NOT NULL AND COALESCE(msa.status::text, '') NOT IN ('cancelled', 'invited')
        ORDER BY msa.deal_id, COALESCE(msa.booked_at, msa.created_at) DESC NULLS LAST
      ),
      vendas_sdr AS MATERIALIZED (
        SELECT v.closer_id, v.credito, NULLIF(lower(btrim(pb.email)), '') AS sdr_email
        FROM vendas v
        LEFT JOIN origem o ON o.attendee_id = v.origem_attendee_id
        LEFT JOIN deal_ultimo_booker db ON db.deal_id = v.deal_id
        LEFT JOIN public.profiles pb ON pb.id = COALESCE(o.booked_by, db.booked_by)
      ),
      -- ---- Cotas contratadas / crédito: useConsorcioCotasContratadas.ts
      --      (tipo_registro='contratacao' por data_contratacao, como na v1)
      cot_cards AS MATERIALIZED (
        SELECT c.id, c.vendedor_name, COALESCE(c.valor_credito, 0)::numeric AS credito,
          CASE WHEN NULLIF(regexp_replace(COALESCE(c.cpf, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(c.cpf, '\D', '', 'g')
               WHEN NULLIF(regexp_replace(COALESCE(c.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(c.cnpj, '\D', '', 'g')
               WHEN public.consorcio_pessoa_nome_key(c.nome_completo) IS NOT NULL THEN 'nome:' || public.consorcio_pessoa_nome_key(c.nome_completo)
               ELSE 'card:' || c.id::text END AS pessoa
        FROM cards_c c
      ),
      -- closer da cota na tela: primeiro closer da BU casado pela chave de nome
      cot_closer_nome AS (
        SELECT DISTINCT ON (public.consorcio_name_key(c.name)) public.consorcio_name_key(c.name) AS nk, c.id AS closer_id
        FROM public.closers c WHERE c.bu = 'consorcio' AND public.consorcio_name_key(c.name) IS NOT NULL
        ORDER BY public.consorcio_name_key(c.name), c.is_active DESC NULLS LAST, c.created_at
      ),
      card_deal AS (
        SELECT DISTINCT ON (r.consortium_card_id) r.consortium_card_id AS card_id, r.deal_id
        FROM public.consorcio_pending_registrations r
        WHERE r.consortium_card_id IN (SELECT cc.id FROM cot_cards cc) AND r.deal_id IS NOT NULL
        ORDER BY r.consortium_card_id, r.created_at
      ),
      -- correção 5 do revisor: ignora perfil com e-mail vazio
      deal_booker AS (
        SELECT DISTINCT ON (msa.deal_id) msa.deal_id, lower(btrim(p.email)) AS sdr_email,
               COALESCE(msa.booked_at, msa.created_at) AS quando
        FROM public.meeting_slot_attendees msa
        JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
        JOIN public.closers cl ON cl.id = ms.closer_id AND cl.bu = 'consorcio'
        JOIN public.profiles p ON p.id = msa.booked_by AND NULLIF(btrim(p.email), '') IS NOT NULL
        WHERE msa.deal_id IN (SELECT cd.deal_id FROM card_deal cd)
          AND COALESCE(msa.status::text, '') NOT IN ('cancelled', 'invited')
        ORDER BY msa.deal_id, COALESCE(msa.booked_at, msa.created_at) DESC NULLS LAST
      ),
      -- atribuição por cliente: o booker mais recente leva todas as cotas do cliente
      cliente_sdr AS (
        SELECT DISTINCT ON (cc.pessoa) cc.pessoa, db.sdr_email
        FROM cot_cards cc JOIN card_deal cd ON cd.card_id = cc.id JOIN deal_booker db ON db.deal_id = cd.deal_id
        ORDER BY cc.pessoa, db.quando DESC NULLS LAST
      ),
      cot_linhas AS MATERIALIZED (
        SELECT cc.id, cc.vendedor_name, cc.credito, cc.pessoa, cn.closer_id, cs.sdr_email
        FROM cot_cards cc
        LEFT JOIN cot_closer_nome cn ON cn.nk = public.consorcio_name_key(cc.vendedor_name)
        LEFT JOIN cliente_sdr cs ON cs.pessoa = cc.pessoa
      ),
      -- ---- Tabela por SDR (só liderança): todos os agendadores dos fatos + quem tem venda/cota.
      --      Outros = sem agendador / vendas sem SDR / cotas sem agendamento.
      sdr_u AS (
        SELECT f.sdr_email AS email,
               count(*) FILTER (WHERE f.fato = 'agendamento') AS agm,
               count(*) FILTER (WHERE f.fato = 'agendada')    AS ag,
               count(*) FILTER (WHERE f.fato = 'realizada')   AS rz,
               count(*) FILTER (WHERE f.fato = 'no_show')     AS ns,
               0::bigint AS vendas, 0::numeric AS producao, 0::bigint AS cotas
        FROM f WHERE v_lider GROUP BY f.sdr_email
        UNION ALL
        SELECT vs.sdr_email, 0, 0, 0, 0, count(*), COALESCE(sum(vs.credito), 0), 0
        FROM vendas_sdr vs WHERE v_lider GROUP BY vs.sdr_email
        UNION ALL
        SELECT cl.sdr_email, 0, 0, 0, 0, 0, 0, count(*)
        FROM cot_linhas cl WHERE v_lider GROUP BY cl.sdr_email
      ),
      sdr_rows AS (
        SELECT (u.email IS NULL) AS outros,
               CASE WHEN u.email IS NULL THEN 'Outros' ELSE COALESCE(
                 (SELECT s2.name FROM public.sdr s2 WHERE lower(btrim(s2.email)) = u.email
                   ORDER BY s2.active DESC NULLS LAST, s2.name LIMIT 1),
                 (SELECT pf.full_name FROM public.profiles pf WHERE lower(btrim(pf.email)) = u.email LIMIT 1),
                 split_part(u.email, '@', 1)) END AS nome,
               sum(u.agm) AS agm, sum(u.ag) AS ag, sum(u.rz) AS rz, sum(u.ns) AS ns,
               sum(u.vendas) AS vendas, sum(u.producao) AS producao, sum(u.cotas) AS cotas
        FROM sdr_u u GROUP BY u.email
      ),
      -- ---- Tabela por closer (só liderança). Cada fonte é levada ao id canônico por e-mail,
      --      para a mesma pessoa não sair em duas linhas (correção 7 do revisor).
      cl_u AS (
        SELECT COALESCE(ic.canon_id, f.closer_id) AS cid,
               count(*) FILTER (WHERE f.fato = 'agendada')  AS ag,
               count(*) FILTER (WHERE f.fato = 'realizada') AS rz,
               count(*) FILTER (WHERE f.fato = 'no_show')   AS ns,
               0::bigint AS vendas, 0::numeric AS producao, 0::bigint AS cotas, 0::numeric AS credito
        FROM f LEFT JOIN id_canon ic ON ic.raw_id = f.closer_id
        WHERE v_lider AND f.fato IN ('agendada','realizada','no_show')
        GROUP BY 1
        UNION ALL
        SELECT b.closer_id, 0, 0, 0, 0, COALESCE(sum(b.credito), 0), 0, 0
        FROM base b WHERE v_lider GROUP BY b.closer_id
        UNION ALL
        SELECT v.closer_id, 0, 0, 0, count(*), 0, 0, 0
        FROM vendas v WHERE v_lider GROUP BY v.closer_id
        UNION ALL
        SELECT ic.canon_id, 0, 0, 0, 0, 0, count(*), COALESCE(sum(l.credito), 0)
        FROM cot_linhas l LEFT JOIN id_canon ic ON ic.raw_id = l.closer_id
        WHERE v_lider GROUP BY ic.canon_id
      ),
      cl_rows AS (
        SELECT (u.cid IS NULL) AS outros,
               CASE WHEN u.cid IS NULL THEN 'Outros'
                    ELSE COALESCE((SELECT c.name FROM public.closers c WHERE c.id = u.cid), 'Closer sem nome') END AS nome,
               sum(u.ag) AS ag, sum(u.rz) AS rz, sum(u.ns) AS ns, sum(u.vendas) AS vendas,
               sum(u.producao) AS producao, sum(u.cotas) AS cotas, sum(u.credito) AS credito
        FROM cl_u u GROUP BY u.cid
      )
      SELECT jsonb_build_object(
        -- globais
        'g_agm', (SELECT count(*) FROM f WHERE f.fato = 'agendamento'),
        'g_ag',  (SELECT count(*) FROM f WHERE f.fato = 'agendada'),
        'g_rz',  (SELECT count(*) FROM f WHERE f.fato = 'realizada'),
        'g_ns',  (SELECT count(*) FROM f WHERE f.fato = 'no_show'),
        'g_vendas', (SELECT count(*) FROM vendas),
        'g_prod',   (SELECT COALESCE(sum(b.credito), 0) FROM base b),
        'g_cotas',  (SELECT count(*) FROM cot_linhas),
        'g_cred',   (SELECT COALESCE(sum(l.credito), 0) FROM cot_linhas l),
        -- meu, como SDR (e-mail do agendador / booker da venda / booker da cota)
        's_agm', (SELECT count(*) FROM f WHERE f.fato = 'agendamento' AND f.sdr_email = v_email),
        's_ag',  (SELECT count(*) FROM f WHERE f.fato = 'agendada'    AND f.sdr_email = v_email),
        's_rz',  (SELECT count(*) FROM f WHERE f.fato = 'realizada'   AND f.sdr_email = v_email),
        's_ns',  (SELECT count(*) FROM f WHERE f.fato = 'no_show'     AND f.sdr_email = v_email),
        's_vendas', (SELECT count(*) FROM vendas_sdr vs WHERE vs.sdr_email = v_email),
        's_prod',   (SELECT COALESCE(sum(vs.credito), 0) FROM vendas_sdr vs WHERE vs.sdr_email = v_email),
        's_cotas',  (SELECT count(*) FROM cot_linhas l WHERE l.sdr_email = v_email),
        's_cred',   (SELECT COALESCE(sum(l.credito), 0) FROM cot_linhas l WHERE l.sdr_email = v_email),
        -- meu, como closer (closer_id cru na agenda; canônico na produção;
        -- chave de nome exclusiva nas cotas e nas pernas B/C da produção, regra da v1)
        'c_ag',  (SELECT count(*) FROM f WHERE f.fato = 'agendada'  AND f.closer_id = ANY (v_closer_ids)),
        'c_rz',  (SELECT count(*) FROM f WHERE f.fato = 'realizada' AND f.closer_id = ANY (v_closer_ids)),
        'c_ns',  (SELECT count(*) FROM f WHERE f.fato = 'no_show'   AND f.closer_id = ANY (v_closer_ids)),
        'c_vendas', (SELECT count(*) FROM vendas v
                     WHERE v.closer_id IN (SELECT mc.canon_id FROM meus_canon mc)
                       AND (v.perna = 'A' OR v.nk = ANY (v_closer_keys))),
        'c_prod',   (SELECT COALESCE(sum(b.credito), 0) FROM base b
                     WHERE b.closer_id IN (SELECT mc.canon_id FROM meus_canon mc)
                       AND (b.perna = 'A' OR b.nk = ANY (v_closer_keys))),
        'c_cotas',  (SELECT count(*) FROM cot_linhas l WHERE public.consorcio_name_key(l.vendedor_name) = ANY (v_closer_keys)),
        'c_cred',   (SELECT COALESCE(sum(l.credito), 0) FROM cot_linhas l WHERE public.consorcio_name_key(l.vendedor_name) = ANY (v_closer_keys)),
        -- tabelas (só liderança)
        'sdrs', CASE WHEN v_lider THEN jsonb_build_object(
          'colunas', jsonb_build_array(
            jsonb_build_object('chave','agendamentos','rotulo','Agendamentos','formato','int'),
            jsonb_build_object('chave','r1_agendada','rotulo','R1 agendadas','formato','int'),
            jsonb_build_object('chave','r1_realizada','rotulo','R1 realizadas','formato','int'),
            jsonb_build_object('chave','no_show','rotulo','No-show','formato','int'),
            jsonb_build_object('chave','vendas_realizadas','rotulo','Vendas','formato','int'),
            jsonb_build_object('chave','producao_gerada','rotulo','Produção','formato','brl'),
            jsonb_build_object('chave','cotas_contratadas','rotulo','Cotas','formato','int')),
          'linhas',
            COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', r.nome,
                        'valores', jsonb_build_array(r.agm, r.ag, r.rz, r.ns, r.vendas, r.producao, r.cotas))
                      ORDER BY r.outros, r.agm DESC, r.ag DESC, r.nome)
                      FROM sdr_rows r
                      WHERE r.agm <> 0 OR r.ag <> 0 OR r.rz <> 0 OR r.ns <> 0 OR r.vendas <> 0 OR r.producao <> 0 OR r.cotas <> 0),
                     '[]'::jsonb)
            || (SELECT jsonb_build_array(jsonb_build_object('nome', 'Total', 'valores', jsonb_build_array(
                  COALESCE(sum(r.agm), 0), COALESCE(sum(r.ag), 0), COALESCE(sum(r.rz), 0), COALESCE(sum(r.ns), 0),
                  COALESCE(sum(r.vendas), 0), COALESCE(sum(r.producao), 0), COALESCE(sum(r.cotas), 0))))
                FROM sdr_rows r),
          'nota', 'Todos que agendaram no período, inclusive quem não está na lista de SDRs da tela (no preset Hoje a tela esconde essas pessoas). Vendas e Produção: venda atribuída a quem agendou a reunião de origem. Cotas: cliente atribuído a quem agendou por último. Outros: sem agendador, vendas sem SDR identificado e cotas sem agendamento.'
        ) END,
        'closers', CASE WHEN v_lider THEN jsonb_build_object(
          'colunas', jsonb_build_array(
            jsonb_build_object('chave','r1_agendada','rotulo','R1 agendadas','formato','int'),
            jsonb_build_object('chave','r1_realizada','rotulo','R1 realizadas','formato','int'),
            jsonb_build_object('chave','no_show','rotulo','No-show','formato','int'),
            jsonb_build_object('chave','vendas_realizadas','rotulo','Vendas','formato','int'),
            jsonb_build_object('chave','producao_gerada','rotulo','Produção','formato','brl'),
            jsonb_build_object('chave','cotas_contratadas','rotulo','Cotas','formato','int'),
            jsonb_build_object('chave','credito_contratado','rotulo','Crédito','formato','brl')),
          'linhas',
            COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', r.nome,
                        'valores', jsonb_build_array(r.ag, r.rz, r.ns, r.vendas, r.producao, r.cotas, r.credito))
                      ORDER BY r.outros, r.ag DESC, r.producao DESC, r.nome)
                      FROM cl_rows r
                      WHERE r.ag <> 0 OR r.rz <> 0 OR r.ns <> 0 OR r.vendas <> 0 OR r.producao <> 0 OR r.cotas <> 0 OR r.credito <> 0),
                     '[]'::jsonb)
            || (SELECT jsonb_build_array(jsonb_build_object('nome', 'Total', 'valores', jsonb_build_array(
                  COALESCE(sum(r.ag), 0), COALESCE(sum(r.rz), 0), COALESCE(sum(r.ns), 0), COALESCE(sum(r.vendas), 0),
                  COALESCE(sum(r.producao), 0), COALESCE(sum(r.cotas), 0), COALESCE(sum(r.credito), 0))))
                FROM cl_rows r),
          'nota', 'Closer com mais de um cadastro (mesmo e-mail) aparece numa linha só. Inclui closers inativos com números no período. Outros: produção sem closer identificado e cotas sem vendedor identificado.'
        ) END
      ) INTO v_r;

      v_metricas := jsonb_build_array(
        jsonb_build_object('chave','agendamentos','rotulo','Agendamentos','formato','int',
          'global', v_r->'g_agm',
          'meu', CASE WHEN v_papel = 'sdr' THEN v_r->'s_agm' END,
          'ajuda','R1 marcadas no período (data em que foi agendada), igual ao card do Painel do Consórcio. Pessoal só para SDR.'),
        jsonb_build_object('chave','r1_agendada','rotulo','R1 agendadas','formato','int',
          'global', v_r->'g_ag',
          'meu', CASE v_papel WHEN 'sdr' THEN v_r->'s_ag' WHEN 'closer' THEN v_r->'c_ag' END,
          'ajuda','Reuniões R1 com data no período (até 2 por negócio). SDR: as que agendou. Closer: as da sua agenda.'),
        jsonb_build_object('chave','r1_realizada','rotulo','R1 realizadas','formato','int',
          'global', v_r->'g_rz',
          'meu', CASE v_papel WHEN 'sdr' THEN v_r->'s_rz' WHEN 'closer' THEN v_r->'c_rz' END,
          'ajuda','R1 com status realizada. Contrato pago na própria reunião não entra aqui (régua do Painel).'),
        jsonb_build_object('chave','no_show','rotulo','No-show','formato','int',
          'global', v_r->'g_ns',
          'meu', CASE v_papel WHEN 'sdr' THEN v_r->'s_ns' WHEN 'closer' THEN v_r->'c_ns' END,
          'ajuda','R1 do período em que o cliente não compareceu.'),
        jsonb_build_object('chave','vendas_realizadas','rotulo','Vendas realizadas','formato','int',
          'global', v_r->'g_vendas',
          'meu', CASE v_papel WHEN 'sdr' THEN v_r->'s_vendas' WHEN 'closer' THEN v_r->'c_vendas' END,
          'ajuda','Clientes distintos que compraram no mês (propostas aceitas, cadastros avulsos e cotas legadas). Closer: pela reunião de origem da proposta; venda avulsa ou legada com nome de vendedor igual ao de outra pessoa não é creditada. SDR: quem agendou a reunião de origem.'),
        jsonb_build_object('chave','producao_gerada','rotulo','Produção gerada','formato','brl',
          'global', v_r->'g_prod',
          'meu', CASE v_papel WHEN 'sdr' THEN v_r->'s_prod' WHEN 'closer' THEN v_r->'c_prod' END,
          'ajuda','Crédito das vendas do período, contado uma vez, igual à linha Total da coluna Produção Gerada. Closer: venda avulsa ou legada com nome de vendedor igual ao de outra pessoa não é creditada. SDR: crédito das vendas atribuídas a você.'),
        jsonb_build_object('chave','cotas_contratadas','rotulo','Cotas contratadas','formato','int',
          'global', v_r->'g_cotas',
          'meu', CASE v_papel WHEN 'sdr' THEN v_r->'s_cotas' WHEN 'closer' THEN v_r->'c_cotas' END,
          'ajuda','Cotas com data de contratação no período. Closer: pelo nome do vendedor na cota (nome igual ao de outra pessoa, closer ou SDR, não é creditado). SDR: quem agendou o cliente por último.'),
        jsonb_build_object('chave','credito_contratado','rotulo','Crédito contratado','formato','brl',
          'global', v_r->'g_cred',
          'meu', CASE v_papel WHEN 'sdr' THEN v_r->'s_cred' WHEN 'closer' THEN v_r->'c_cred' END,
          'ajuda','Soma do crédito das cotas contratadas no período.')
      );

      IF v_lider THEN
        v_pessoas := jsonb_build_object('sdrs', v_r->'sdrs', 'closers', v_r->'closers');
      END IF;

    ELSE
      -- ===============================================================
      -- INCORPORADOR MCF
      -- ===============================================================

      -- ---- Bloco 1: Agenda R1 + Contratos (useR1CloserMetrics.ts + ReunioesEquipe.tsx).
      --      Card = soma das linhas de closer. Closers inativos saem só quando o período
      --      inclui hoje (isLivePeriod); período passado inclui inativos (corrige a v1).
      --      caucoes_efetivas e caucoes_orfas: 1 chamada cada.
      WITH
      cl AS MATERIALIZED (
        SELECT c.id, c.name, c.is_active, NULLIF(c.meeting_type::text, '') AS meeting_type,
               NULLIF(lower(btrim(c.email)), '') AS email
        FROM public.closers c WHERE c.bu = 'incorporador'
      ),
      -- R1 literal: slot r1 não cancelado, attendee sem parceiro, com negócio, status válido
      r1 AS (
        SELECT ms.closer_id,
               count(*) AS r1_agendada,
               count(*) FILTER (WHERE msa.status IN ('completed','contract_paid','refunded')) AS r1_realizada,
               count(*) FILTER (WHERE msa.status = 'no_show') AS no_show
        FROM public.meeting_slots ms
        JOIN public.meeting_slot_attendees msa ON msa.meeting_slot_id = ms.id
        WHERE ms.meeting_type = 'r1'
          AND ms.status IS NOT NULL AND ms.status NOT IN ('cancelled','canceled')
          AND ms.scheduled_at >= (v_ini::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND ms.scheduled_at <  ((v_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND msa.is_partner IS NOT TRUE AND msa.deal_id IS NOT NULL
          AND msa.status IN ('scheduled','invited','completed','no_show','contract_paid','refunded','rescheduled')
          AND ms.closer_id IN (SELECT c.id FROM cl c)
        GROUP BY ms.closer_id
      ),
      -- Agendamentos (eixo closer, booked_at, até 2 dias por closer+negócio; sem negócio conta 1)
      ag AS (
        SELECT x.closer_id, sum(x.n) AS agendamentos FROM (
          SELECT ms.closer_id,
                 CASE WHEN msa.deal_id IS NULL THEN count(*)
                      ELSE LEAST(count(DISTINCT (msa.booked_at AT TIME ZONE 'America/Sao_Paulo')::date), 2) END AS n
          FROM public.meeting_slot_attendees msa
          JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
          WHERE ms.meeting_type = 'r1' AND COALESCE(ms.status, '') NOT IN ('cancelled','canceled')
            AND msa.is_partner = false AND msa.booked_at IS NOT NULL
            AND msa.booked_at >= (v_ini::timestamp AT TIME ZONE 'America/Sao_Paulo')
            AND msa.booked_at <  ((v_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
            AND msa.status IN ('scheduled','invited','completed','no_show','contract_paid','refunded','rescheduled')
            AND ms.closer_id IN (SELECT c.id FROM cl c)
          GROUP BY ms.closer_id, msa.deal_id, CASE WHEN msa.deal_id IS NULL THEN msa.id END
        ) x
        GROUP BY x.closer_id
      ),
      -- Contratos: régua caução (caucoes_efetivas), bruto = líquido + reembolsados
      ce AS MATERIALIZED (
        SELECT x.closer_id, x.refunded_at
        FROM public.caucoes_efetivas(p_from => v_ini, p_to => v_fim, p_bu => 'incorporador') x
      ),
      orf AS MATERIALIZED (
        SELECT count(*) AS n FROM public.caucoes_orfas(p_from => v_ini, p_to => v_fim)
      ),
      ct AS (
        SELECT e.closer_id,
               count(*) FILTER (WHERE e.refunded_at IS NULL) AS liq,
               count(*) FILTER (WHERE e.refunded_at IS NOT NULL) AS reemb
        FROM ce e WHERE e.closer_id IS NOT NULL GROUP BY e.closer_id
      ),
      man AS (
        SELECT m.closer_id, count(*) AS n
        FROM public.manual_sale_attributions m
        WHERE m.business_unit = 'incorporador'
          AND m.contract_paid_at >= (v_ini::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND m.contract_paid_at <  ((v_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
        GROUP BY m.closer_id
      ),
      -- Coluna "R2 Agendada" da aba Closers (só liderança): R2 atribuída ao closer da R1
      -- do negócio (R1 dos últimos 6 meses, booker SDR ativo do squad ou closer da BU)
      validos AS (
        SELECT lower(btrim(s.email)) AS email FROM public.sdr s
        WHERE v_lider AND s.active AND s.squad = 'incorporador' AND s.email IS NOT NULL
        UNION SELECT c.email FROM cl c WHERE v_lider AND c.email IS NOT NULL
      ),
      r1map AS (
        SELECT DISTINCT ON (msa.deal_id) msa.deal_id, ms.closer_id
        FROM public.meeting_slot_attendees msa
        JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
        JOIN public.profiles p ON p.id = msa.booked_by
        WHERE v_lider
          AND ms.meeting_type = 'r1' AND ms.status IS NOT NULL AND ms.status NOT IN ('cancelled','canceled')
          AND ms.scheduled_at >= ((v_ini - interval '6 months')::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND msa.deal_id IS NOT NULL AND ms.closer_id IS NOT NULL
          AND msa.status IN ('scheduled','invited','completed','no_show','contract_paid','refunded','rescheduled')
          AND lower(btrim(p.email)) IN (SELECT va.email FROM validos va)
        ORDER BY msa.deal_id, ms.scheduled_at
      ),
      r2col AS (
        SELECT m.closer_id, count(*) AS n
        FROM public.meeting_slot_attendees a
        JOIN public.meeting_slots s ON s.id = a.meeting_slot_id
        JOIN r1map m ON m.deal_id = a.deal_id
        WHERE v_lider
          AND s.meeting_type = 'r2' AND s.status IS NOT NULL AND s.status <> 'cancelled'
          AND s.scheduled_at >= (v_ini::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND s.scheduled_at <  ((v_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
        GROUP BY m.closer_id
      ),
      linhas AS MATERIALIZED (
        SELECT c.id AS closer_id, c.name AS nome,
               COALESCE(r1.r1_agendada, 0) AS r1_agendada,
               COALESCE(r1.r1_realizada, 0) AS r1_realizada,
               COALESCE(r1.no_show, 0) AS no_show,
               COALESCE(ag.agendamentos, 0) AS agendamentos,
               COALESCE(ct.liq, 0) + COALESCE(man.n, 0) + COALESCE(ct.reemb, 0) AS contrato_bruto,
               COALESCE(r2c.n, 0) AS r2_agendada
        FROM cl c
        LEFT JOIN r1 ON r1.closer_id = c.id
        LEFT JOIN ag ON ag.closer_id = c.id
        LEFT JOIN ct ON ct.closer_id = c.id
        LEFT JOIN man ON man.closer_id = c.id
        LEFT JOIN r2col r2c ON r2c.closer_id = c.id
        WHERE ((c.is_active IS TRUE AND COALESCE(c.meeting_type, 'r1') = 'r1')
               OR r1.closer_id IS NOT NULL OR ag.closer_id IS NOT NULL OR ct.closer_id IS NOT NULL
               OR man.closer_id IS NOT NULL OR r2c.closer_id IS NOT NULL)
          AND NOT (v_live AND c.is_active IS NOT TRUE)
      ),
      nao_atrib AS MATERIALIZED (
        -- "Não atribuído" do card Contratos: caução sem closer + órfãs (useUnassignedContracts.ts)
        SELECT (SELECT count(*) FROM ce e WHERE e.closer_id IS NULL) + (SELECT o.n FROM orf o) AS n
      )
      SELECT jsonb_build_object(
        'g_agm', (SELECT COALESCE(sum(l.agendamentos), 0) FROM linhas l),
        'g_ag',  (SELECT COALESCE(sum(l.r1_agendada), 0) FROM linhas l),
        'g_rz',  (SELECT COALESCE(sum(l.r1_realizada), 0) FROM linhas l),
        'g_ns',  (SELECT COALESCE(sum(l.no_show), 0) FROM linhas l),
        'g_ct',  (SELECT COALESCE(sum(l.contrato_bruto), 0) FROM linhas l) + (SELECT na.n FROM nao_atrib na),
        -- meu como closer R1: contagem literal nos próprios closer_ids (mesmas linhas do Painel)
        'c_tem_r1', (EXISTS (SELECT 1 FROM linhas l WHERE l.closer_id = ANY (v_closer_ids))
                     OR EXISTS (SELECT 1 FROM cl c WHERE c.id = ANY (v_closer_ids) AND COALESCE(c.meeting_type, 'r1') = 'r1')),
        'c_ag',  (SELECT COALESCE(sum(l.r1_agendada), 0) FROM linhas l WHERE l.closer_id = ANY (v_closer_ids)),
        'c_rz',  (SELECT COALESCE(sum(l.r1_realizada), 0) FROM linhas l WHERE l.closer_id = ANY (v_closer_ids)),
        'c_ns',  (SELECT COALESCE(sum(l.no_show), 0) FROM linhas l WHERE l.closer_id = ANY (v_closer_ids)),
        'c_ct',  (SELECT COALESCE(sum(l.contrato_bruto), 0) FROM linhas l WHERE l.closer_id = ANY (v_closer_ids)),
        'closers', CASE WHEN v_lider THEN jsonb_build_object(
          'colunas', jsonb_build_array(
            jsonb_build_object('chave','agendamentos','rotulo','Agendamentos','formato','int'),
            jsonb_build_object('chave','r1_agendada','rotulo','R1 agendadas','formato','int'),
            jsonb_build_object('chave','r1_realizada','rotulo','R1 realizadas','formato','int'),
            jsonb_build_object('chave','no_show','rotulo','No-show','formato','int'),
            jsonb_build_object('chave','contratos','rotulo','Contratos','formato','int'),
            jsonb_build_object('chave','r2_agendadas','rotulo','R2 agendadas','formato','int')),
          'linhas',
            COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', l.nome,
                        'valores', jsonb_build_array(l.agendamentos, l.r1_agendada, l.r1_realizada, l.no_show, l.contrato_bruto, l.r2_agendada))
                      ORDER BY l.r1_agendada DESC, l.r1_realizada DESC, l.nome)
                      FROM linhas l
                      WHERE l.agendamentos <> 0 OR l.r1_agendada <> 0 OR l.r1_realizada <> 0 OR l.no_show <> 0
                         OR l.contrato_bruto <> 0 OR l.r2_agendada <> 0),
                     '[]'::jsonb)
            || (SELECT CASE WHEN na.n > 0 THEN jsonb_build_array(jsonb_build_object('nome', 'Outros',
                       'valores', jsonb_build_array(0, 0, 0, 0, na.n, 0))) ELSE '[]'::jsonb END
                FROM nao_atrib na)
            || (SELECT jsonb_build_array(jsonb_build_object('nome', 'Total', 'valores', jsonb_build_array(
                  COALESCE(sum(l.agendamentos), 0), COALESCE(sum(l.r1_agendada), 0), COALESCE(sum(l.r1_realizada), 0),
                  COALESCE(sum(l.no_show), 0), COALESCE(sum(l.contrato_bruto), 0) + (SELECT na.n FROM nao_atrib na),
                  COALESCE(sum(l.r2_agendada), 0))))
                FROM linhas l),
          'nota', 'Mesma régua da aba Closers do Painel Comercial: o Total fecha com os cards. Contratos: bruto (inclui reembolsados); Outros = contratos sem closer identificado. R2 agendadas aqui é a coluna da aba Closers (R2 atribuída ao closer da R1, linha por linha) e não bate com o card de R2, que conta por lead.'
        ) END
      ) INTO v_r;

      -- ---- Bloco 2: R2 (Agenda R2: R2AgendaKPICards.tsx + useR2MeetingsExtended.ts).
      --      Dedup por lead no período; realizada se qualquer R2 completed/contract_paid/refunded;
      --      no-show só se teve no_show e nenhuma realizada. Correção 6: só closers do Incorporador.
      WITH att AS MATERIALIZED (
        SELECT ms.closer_id AS closer_r2_id, msa.status,
               COALESCE(msa.deal_id::text,
                        NULLIF(lower(btrim(cc.email)), ''),
                        NULLIF(right(regexp_replace(COALESCE(NULLIF(msa.attendee_phone, ''), cc.phone, ''), '\D', '', 'g'), 9), ''),
                        msa.id::text) AS lead_key
        FROM public.meeting_slot_attendees msa
        JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
        -- slot sem closer entra (a Agenda R2 conta); closer de outra BU sai (correção 6)
        LEFT JOIN public.closers cr2 ON cr2.id = ms.closer_id
        LEFT JOIN public.crm_deals d ON d.id = msa.deal_id
        LEFT JOIN public.crm_contacts cc ON cc.id = d.contact_id
        WHERE ms.meeting_type = 'r2'
          AND (ms.closer_id IS NULL OR cr2.bu = 'incorporador')
          AND ms.scheduled_at >= (v_ini::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND ms.scheduled_at <  ((v_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND COALESCE(msa.status, '') NOT IN ('cancelled', 'pre_scheduled', 'rescheduled')
      ),
      l_tot AS (
        SELECT a.lead_key,
               bool_or(a.status IN ('completed','contract_paid','refunded')) AS rz,
               bool_or(a.status = 'no_show') AS ns
        FROM att a GROUP BY a.lead_key
      ),
      l_meu AS (
        SELECT a.lead_key,
               bool_or(a.status IN ('completed','contract_paid','refunded')) AS rz,
               bool_or(a.status = 'no_show') AS ns
        FROM att a WHERE a.closer_r2_id = ANY (v_r2_ids) GROUP BY a.lead_key
      )
      SELECT jsonb_build_object(
        'g_ag', (SELECT count(*) FROM l_tot),
        'g_rz', (SELECT count(*) FILTER (WHERE t.rz) FROM l_tot t),
        'g_ns', (SELECT count(*) FILTER (WHERE t.ns AND NOT t.rz) FROM l_tot t),
        'm_ag', (SELECT count(*) FROM l_meu),
        'm_rz', (SELECT count(*) FILTER (WHERE m.rz) FROM l_meu m),
        'm_ns', (SELECT count(*) FILTER (WHERE m.ns AND NOT m.rz) FROM l_meu m)
      ) INTO v_r2;

      -- ---- Bloco 3: Vendas realizadas = High Ticket únicas da Hubla (régua do relatório diário,
      --      migration 20261012231822): pares distintos e-mail + produto A001/A009,
      --      sale_status 'completed', dia de Brasília. Só global.
      SELECT count(*) INTO v_vendas FROM (
        SELECT lower(btrim(t.customer_email)) AS em, upper(left(btrim(t.product_name), 4)) AS prod
        FROM public.hubla_transactions t
        WHERE t.sale_status = 'completed'
          AND (t.product_name ILIKE 'A001%' OR t.product_name ILIKE 'A009%')
          AND t.sale_date >= (v_ini::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND t.sale_date <  ((v_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND COALESCE(btrim(t.customer_email), '') <> ''
        GROUP BY 1, 2
      ) x;

      -- ---- Bloco 4: SDRs (get_sdr_metrics_from_agenda, linha da SDR no Painel).
      --      1 chamada; só quando a pessoa é SDR ou liderança. Liderança: filtro de e-mail NULL
      --      (tabela inteira). SDR comum: filtro pelo próprio e-mail (a RPC filtra antes de
      --      agrupar por SDR, então a linha dela é idêntica e a chamada fica mais leve).
      v_m_sdr := NULL;
      v_tab_sdr := NULL;
      IF v_papel = 'sdr' OR v_lider THEN
        v_sdrm := public.get_sdr_metrics_from_agenda(
                    v_ini::text, v_fim::text,
                    CASE WHEN v_lider THEN NULL ELSE v_email END,
                    'incorporador', NULL);

        IF v_papel = 'sdr' THEN
          SELECT jsonb_build_object(
                   'agm', COALESCE(sum((e->>'agendamentos')::numeric), 0),
                   'ag',  COALESCE(sum((e->>'r1_agendada')::numeric), 0),
                   'rz',  COALESCE(sum((e->>'r1_realizada')::numeric), 0),
                   'ns',  COALESCE(sum((e->>'no_shows')::numeric), 0),
                   'ct',  COALESCE(sum((e->>'contratos')::numeric), 0))
            INTO v_m_sdr
          FROM json_array_elements(v_sdrm->'metrics') e
          WHERE lower(btrim(e->>'sdr_email')) = v_email;
        END IF;

        IF v_lider THEN
          -- Linhas = roster da tela: get_sdrs_for_squad_in_period menos quem tem papel
          -- admin/manager/coordenador/assistente_administrativo/closer/closer_sombra
          -- (ReunioesEquipe.tsx; correção 9: profiles.email comparado sem lower, como a tela).
          WITH m AS (
            SELECT NULLIF(lower(btrim(e->>'sdr_email')), '') AS email,
                   sum((e->>'agendamentos')::numeric) AS agm,
                   sum((e->>'r1_agendada')::numeric)  AS ag,
                   sum((e->>'r1_realizada')::numeric) AS rz,
                   sum((e->>'no_shows')::numeric)     AS ns,
                   sum((e->>'contratos')::numeric)    AS ct
            FROM json_array_elements(v_sdrm->'metrics') e
            GROUP BY 1
          ),
          bloq AS (
            SELECT DISTINCT p.email FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id
            WHERE ur.role::text IN ('admin','manager','coordenador','assistente_administrativo','closer','closer_sombra')
              AND p.email IS NOT NULL
          ),
          roster AS (
            SELECT DISTINCT ON (lower(s.email)) lower(s.email) AS email, s.name
            FROM public.get_sdrs_for_squad_in_period(
                   p_squad => 'incorporador',
                   p_start => (v_ini::timestamp AT TIME ZONE 'America/Sao_Paulo'),
                   p_end   => ((v_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') - interval '1 millisecond') s
            WHERE s.email IS NOT NULL AND lower(s.email) NOT IN (SELECT b.email FROM bloq b)
            ORDER BY lower(s.email), s.name
          ),
          rows_ AS (
            SELECT false AS outros, r.name AS nome,
                   COALESCE(m.agm, 0) AS agm, COALESCE(m.ag, 0) AS ag, COALESCE(m.rz, 0) AS rz,
                   COALESCE(m.ns, 0) AS ns, COALESCE(m.ct, 0) AS ct
            FROM roster r LEFT JOIN m ON m.email = r.email
            UNION ALL
            SELECT true, 'Outros',
                   COALESCE(sum(m.agm), 0), COALESCE(sum(m.ag), 0), COALESCE(sum(m.rz), 0),
                   COALESCE(sum(m.ns), 0), COALESCE(sum(m.ct), 0)
            FROM m WHERE m.email IS NULL OR m.email NOT IN (SELECT r.email FROM roster r)
          )
          SELECT jsonb_build_object(
            'colunas', jsonb_build_array(
              jsonb_build_object('chave','agendamentos','rotulo','Agendamentos','formato','int'),
              jsonb_build_object('chave','r1_agendada','rotulo','R1 agendadas','formato','int'),
              jsonb_build_object('chave','r1_realizada','rotulo','R1 realizadas','formato','int'),
              jsonb_build_object('chave','no_show','rotulo','No-show','formato','int'),
              jsonb_build_object('chave','contratos','rotulo','Contratos','formato','int')),
            'linhas',
              COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', x.nome,
                          'valores', jsonb_build_array(x.agm, x.ag, x.rz, x.ns, x.ct))
                        ORDER BY x.outros, x.agm DESC, x.rz DESC, x.nome)
                        FROM rows_ x
                        WHERE x.agm <> 0 OR x.ag <> 0 OR x.rz <> 0 OR x.ns <> 0 OR x.ct <> 0),
                       '[]'::jsonb)
              || (SELECT jsonb_build_array(jsonb_build_object('nome', 'Total', 'valores', jsonb_build_array(
                    COALESCE(sum(x.agm), 0), COALESCE(sum(x.ag), 0), COALESCE(sum(x.rz), 0),
                    COALESCE(sum(x.ns), 0), COALESCE(sum(x.ct), 0))))
                  FROM rows_ x),
            'nota', 'Régua da tabela de SDRs do Painel Comercial (quem agendou, até 2 por negócio, contrato líquido sem reembolsados). Por isso a soma não bate com os cards, que contam a agenda do closer e o contrato bruto. Outros: quem agendou e não está na lista de SDRs da tela (closer, coordenador, outro squad).'
          ) INTO v_tab_sdr;
        END IF;
      END IF;

      v_metricas := jsonb_build_array(
        jsonb_build_object('chave','agendamentos','rotulo','Agendamentos','formato','int',
          'global', v_r->'g_agm',
          'meu', CASE WHEN v_papel = 'sdr' THEN v_m_sdr->'agm' END,
          'ajuda','R1 marcadas no período (data em que foi agendada), soma das linhas de closer do Painel. SDR: régua da tabela de SDRs. Dia de Brasília (00:00 a 23:59); o Painel web hoje usa 03:00 a 02:59 e pode diferir em agendamentos de madrugada.'),
        jsonb_build_object('chave','r1_agendada','rotulo','R1 agendadas','formato','int',
          'global', v_r->'g_ag',
          'meu', CASE WHEN v_papel = 'sdr' THEN v_m_sdr->'ag'
                      WHEN v_papel = 'closer' AND (v_r->>'c_tem_r1')::boolean THEN v_r->'c_ag' END,
          'ajuda','Equipe e closer: contagem da Agenda R1. SDR: régua da tabela de SDRs (até 2 por negócio). Dia de Brasília (00:00 a 23:59); o Painel web hoje usa 03:00 a 02:59 e pode diferir em reuniões de madrugada.'),
        jsonb_build_object('chave','r1_realizada','rotulo','R1 realizadas','formato','int',
          'global', v_r->'g_rz',
          'meu', CASE WHEN v_papel = 'sdr' THEN v_m_sdr->'rz'
                      WHEN v_papel = 'closer' AND (v_r->>'c_tem_r1')::boolean THEN v_r->'c_rz' END),
        jsonb_build_object('chave','no_show','rotulo','No-show','formato','int',
          'global', v_r->'g_ns',
          'meu', CASE WHEN v_papel = 'sdr' THEN v_m_sdr->'ns'
                      WHEN v_papel = 'closer' AND (v_r->>'c_tem_r1')::boolean THEN v_r->'c_ns' END),
        jsonb_build_object('chave','contratos','rotulo','Contratos pagos','formato','int',
          'global', v_r->'g_ct',
          'meu', CASE WHEN v_papel = 'sdr' THEN v_m_sdr->'ct'
                      WHEN v_papel = 'closer' AND (v_r->>'c_tem_r1')::boolean THEN v_r->'c_ct' END,
          'ajuda','Equipe: card Contratos do Painel (inclui reembolsados e não atribuídos). Closer: bruto. SDR: líquido, como na tabela de SDRs. Atribuições manuais contam pelo dia de Brasília (00:00 a 23:59); o Painel web hoje usa 03:00 a 02:59.'),
        jsonb_build_object('chave','r2_agendadas','rotulo','R2 agendadas','formato','int',
          'global', v_r2->'g_ag',
          'meu', CASE WHEN cardinality(v_r2_ids) > 0 THEN v_r2->'m_ag' END,
          'ajuda','Agenda R2: cada lead conta uma vez no período. Pessoal só para quem faz R2.'),
        jsonb_build_object('chave','r2_realizadas','rotulo','R2 realizadas','formato','int',
          'global', v_r2->'g_rz',
          'meu', CASE WHEN cardinality(v_r2_ids) > 0 THEN v_r2->'m_rz' END,
          'ajuda','Leads com pelo menos uma R2 realizada no período.'),
        jsonb_build_object('chave','r2_no_show','rotulo','No-show R2','formato','int',
          'global', v_r2->'g_ns',
          'meu', CASE WHEN cardinality(v_r2_ids) > 0 THEN v_r2->'m_ns' END,
          'ajuda','Leads que faltaram e não fizeram nenhuma R2 no período.'),
        jsonb_build_object('chave','vendas_realizadas','rotulo','Vendas realizadas','formato','int',
          'global', to_jsonb(v_vendas),
          'meu', NULL::jsonb,
          'ajuda','High Ticket (A001 e A009) pagas na Hubla, um por cliente e produto, igual ao relatório diário. Sem número por pessoa.')
      );

      IF v_lider THEN
        v_pessoas := jsonb_build_object('sdrs', v_tab_sdr, 'closers', v_r->'closers');
      END IF;
    END IF;

    v_bus := v_bus || jsonb_build_object(
      'bu', v_bu,
      'titulo', v_titulo,
      'papel', v_papel,
      'periodo', jsonb_build_object(
        'chave', v_preset,
        'rotulo', v_rotulo,
        'ini', to_char(v_ini, 'YYYY-MM-DD'),
        'fim', to_char(v_fim, 'YYYY-MM-DD')),
      'metricas', v_metricas,
      'pessoas', v_pessoas
    );
  END LOOP;

  RETURN jsonb_build_object(
    'gerado_em', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"'),
    'nome', v_nome,
    'lider', v_lider,
    'bus', v_bus
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.resumo_app_v2(text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_app_v2(text, date, date) TO authenticated;

COMMENT ON FUNCTION public.resumo_app_v2(text, date, date) IS
  'App MCF Gestão (iPhone): um período por chamada (hoje/semana/mes/custom). Números globais da BU + números da própria pessoa (auth.uid()); tabelas por SDR e por closer só para admin/manager/coordenador. Só leitura.';