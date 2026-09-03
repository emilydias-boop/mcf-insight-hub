-- ═══════════════════════════════════════════════════════════════════════════
-- Helpers de normalização (porte fiel de nameKey / clientePessoaKey do front)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.consorcio_name_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH clean AS (
    SELECT nullif(btrim(regexp_replace(
      translate(lower(coalesce(p_name, '')),
        'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
        'aaaaaaeeeeiiiiooooouuuucnyy'),
      '[^a-z]+', ' ', 'g')), '') AS t
  )
  SELECT CASE
    WHEN t IS NULL THEN NULL
    ELSE split_part(t, ' ', 1) || '|' ||
         (regexp_split_to_array(t, ' '))[array_length(regexp_split_to_array(t, ' '), 1)]
  END
  FROM clean;
$$;

CREATE OR REPLACE FUNCTION public.consorcio_pessoa_nome_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(btrim(regexp_replace(
    upper(translate(coalesce(p_name, ''),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
      'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNY')),
    '\s+', ' ', 'g')), '');
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUÇÃO GERADA — porte fiel de src/hooks/useConsorcioProducaoGerada.ts
-- 100% leitura. Três pernas, quatro caminhos de dedup, cascata de atribuição.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.consorcio_producao_gerada(
  p_ini date,
  p_fim date,
  p_bu text DEFAULT 'consorcio'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH closers_bu AS (
  SELECT c.id, c.name, nullif(lower(btrim(c.email)), '') AS ek,
         c.is_active, c.created_at
  FROM public.closers c
  WHERE c.bu = p_bu
),
canon AS (
  SELECT ek, id FROM (
    SELECT ek, id,
           row_number() OVER (
             PARTITION BY ek
             ORDER BY (is_active IS TRUE) DESC, coalesce(created_at::text, '') ASC, id
           ) AS rn
    FROM closers_bu WHERE ek IS NOT NULL
  ) x WHERE rn = 1
),
id_canon AS (
  SELECT c.id AS raw_id, coalesce(cn.id, c.id) AS canon_id
  FROM closers_bu c LEFT JOIN canon cn ON cn.ek = c.ek
),
nome_closer AS (
  SELECT nk, closer_id FROM (
    SELECT public.consorcio_name_key(c.name) AS nk,
           coalesce(cn.id, c.id) AS closer_id,
           row_number() OVER (
             PARTITION BY public.consorcio_name_key(c.name)
             ORDER BY CASE WHEN c.ek IS NULL THEN 1 ELSE 0 END,
                      coalesce(c.created_at::text, ''), c.id
           ) AS rn
    FROM closers_bu c LEFT JOIN canon cn ON cn.ek = c.ek
    WHERE public.consorcio_name_key(c.name) IS NOT NULL
      AND (c.ek IS NULL OR cn.id = c.id)
  ) x WHERE rn = 1
),

-- ══ PERNA A — propostas aceitas, âncora coalesce(aceite_date, proposal_date)
props AS (
  SELECT p.id, p.deal_id, p.created_by,
         coalesce(p.aceite_date, p.proposal_date) AS ancora
  FROM public.consorcio_proposals p
  WHERE p.status = 'aceita'
    AND p.deleted_at IS NULL
    AND coalesce(p.carta_excluida, false) = false
    AND coalesce(p.aceite_date, p.proposal_date) BETWEEN p_ini AND p_fim
),
cartas_agg AS (
  SELECT k.proposal_id,
         sum(coalesce(k.valor_credito, 0)) AS credito,
         count(*)::int AS qtd
  FROM public.consorcio_proposal_cartas k
  JOIN props pr ON pr.id = k.proposal_id
  GROUP BY k.proposal_id
),
-- fallback 2: closer da reunião mais recente do deal (só closers da BU)
prop_reuniao AS (
  SELECT deal_id, canon_id AS closer_id FROM (
    SELECT msa.deal_id, ic.canon_id, ms.scheduled_at,
           row_number() OVER (PARTITION BY msa.deal_id ORDER BY ms.scheduled_at DESC) AS rn
    FROM public.meeting_slot_attendees msa
    JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
    JOIN id_canon ic ON ic.raw_id = ms.closer_id
    WHERE msa.deal_id IN (SELECT deal_id FROM props WHERE deal_id IS NOT NULL)
  ) x WHERE rn = 1
),
perna_a AS (
  SELECT pr.id,
         coalesce(ec1.id, ec2.id, mr.closer_id) AS closer_id,
         ca.credito, ca.qtd
  FROM props pr
  JOIN cartas_agg ca ON ca.proposal_id = pr.id
  LEFT JOIN public.profiles pf ON pf.id = pr.created_by
  LEFT JOIN canon ec1 ON ec1.ek = nullif(lower(btrim(pf.email)), '')
  LEFT JOIN public.crm_deals d ON d.id = pr.deal_id
  LEFT JOIN canon ec2 ON ec2.ek = nullif(lower(btrim(d.owner_id)), '')
  LEFT JOIN prop_reuniao mr ON mr.deal_id = pr.deal_id
),

-- ══ PERNA C (definida antes por causa dos card ids candidatos)
cards_c AS (
  SELECT c.id, c.vendedor_name, coalesce(c.valor_credito, 0) AS valor_credito,
         c.cpf, c.cnpj, c.nome_completo
  FROM public.consortium_cards c
  WHERE c.tipo_registro = 'contratacao'
    AND c.data_contratacao BETWEEN p_ini AND p_fim
),

-- ══ PERNA B — cadastros com aceite_date no período
regs AS (
  SELECT r.id, r.proposal_id, r.consortium_card_id, r.aceite_date, r.created_at,
         coalesce(r.valor_credito, 0) AS valor_credito,
         r.vendedor_name, r.vendedor_name_cota, r.cpf, r.cnpj,
         r.nome_completo, r.razao_social
  FROM public.consorcio_pending_registrations r
  WHERE r.aceite_date BETWEEN p_ini AND p_fim
),
-- cadastros criados no período com aceite de mês anterior (aviso, não número)
retro_cand AS (
  SELECT r.id, r.proposal_id, r.consortium_card_id, r.aceite_date, r.created_at,
         coalesce(r.valor_credito, 0) AS valor_credito,
         r.vendedor_name, r.vendedor_name_cota
  FROM public.consorcio_pending_registrations r
  WHERE r.created_at >= p_ini::timestamptz
    AND r.created_at < (p_fim + 1)::timestamptz
    AND r.aceite_date IS NOT NULL
    AND to_char(r.aceite_date, 'YYYY-MM') < to_char(r.created_at, 'YYYY-MM')
),
cand_cards AS (
  SELECT DISTINCT consortium_card_id AS cid FROM regs WHERE consortium_card_id IS NOT NULL
  UNION
  SELECT DISTINCT consortium_card_id FROM retro_cand WHERE consortium_card_id IS NOT NULL
  UNION
  SELECT id FROM cards_c
),
-- OS QUATRO CAMINHOS DE DEDUP. Remover um duplica dinheiro.
cards_vinc AS (
  SELECT cc.cid FROM cand_cards cc
  WHERE EXISTS (SELECT 1 FROM public.consorcio_proposals p WHERE p.consortium_card_id = cc.cid)
     OR EXISTS (SELECT 1 FROM public.consorcio_proposal_cartas k WHERE k.consortium_card_id = cc.cid)
     OR EXISTS (SELECT 1 FROM public.consorcio_pending_registrations r
                WHERE r.consortium_card_id = cc.cid AND r.proposal_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.consorcio_pending_registrations r
                JOIN public.consorcio_proposal_cartas k2 ON k2.pending_registration_id = r.id
                WHERE r.consortium_card_id = cc.cid)
),
regs_avulsos AS (
  SELECT r.*,
         coalesce(r.vendedor_name_cota, r.vendedor_name) AS vend,
         (to_char(r.aceite_date, 'YYYY-MM') < to_char(r.created_at, 'YYYY-MM')) AS antedatado
  FROM regs r
  WHERE r.proposal_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.consorcio_proposal_cartas k
                    WHERE k.pending_registration_id = r.id)
    AND (r.consortium_card_id IS NULL
         OR r.consortium_card_id NOT IN (SELECT cid FROM cards_vinc))
),
retro_avulsos AS (
  SELECT r.*, coalesce(r.vendedor_name_cota, r.vendedor_name) AS vend
  FROM retro_cand r
  WHERE r.proposal_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.consorcio_proposal_cartas k
                    WHERE k.pending_registration_id = r.id)
    AND (r.consortium_card_id IS NULL
         OR r.consortium_card_id NOT IN (SELECT cid FROM cards_vinc))
),
residuo AS (
  SELECT c.* FROM cards_c c
  WHERE NOT EXISTS (SELECT 1 FROM public.consorcio_pending_registrations r
                    WHERE r.consortium_card_id = c.id)
    AND c.id NOT IN (SELECT cid FROM cards_vinc)
),

-- ══ Linhas unificadas: crédito e cartas
linhas AS (
  SELECT coalesce(a.closer_id::text, '__sem__') AS closer_key, 'A' AS perna,
         a.credito, a.qtd AS cartas, 1 AS vendas_a, 0 AS antedatados,
         0::numeric AS antedatados_credito
  FROM perna_a a
  UNION ALL
  SELECT coalesce(nc.closer_id::text, '__sem__'), 'B',
         b.valor_credito, 1, 0,
         CASE WHEN b.antedatado THEN 1 ELSE 0 END,
         CASE WHEN b.antedatado THEN b.valor_credito ELSE 0 END
  FROM regs_avulsos b
  LEFT JOIN nome_closer nc ON nc.nk = public.consorcio_name_key(b.vend)
  UNION ALL
  SELECT coalesce(nc.closer_id::text, '__sem__'), 'C',
         c.valor_credito, 1, 0, 0, 0::numeric
  FROM residuo c
  LEFT JOIN nome_closer nc ON nc.nk = public.consorcio_name_key(c.vendedor_name)
),
-- ══ Vendas das pernas B e C: pessoas distintas POR CLOSER
pessoas_b AS (
  SELECT DISTINCT coalesce(nc.closer_id::text, '__sem__') AS closer_key,
    CASE
      WHEN nullif(regexp_replace(coalesce(b.cpf, ''), '\D', '', 'g'), '') IS NOT NULL
        THEN 'doc:' || regexp_replace(b.cpf, '\D', '', 'g')
      WHEN nullif(regexp_replace(coalesce(b.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
        THEN 'doc:' || regexp_replace(b.cnpj, '\D', '', 'g')
      WHEN public.consorcio_pessoa_nome_key(coalesce(b.nome_completo, b.razao_social)) IS NOT NULL
        THEN 'nome:' || public.consorcio_pessoa_nome_key(coalesce(b.nome_completo, b.razao_social))
      ELSE 'card:' || b.id::text
    END AS pessoa
  FROM regs_avulsos b
  LEFT JOIN nome_closer nc ON nc.nk = public.consorcio_name_key(b.vend)
),
pessoas_c AS (
  SELECT DISTINCT coalesce(nc.closer_id::text, '__sem__') AS closer_key,
    CASE
      WHEN nullif(regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g'), '') IS NOT NULL
        THEN 'doc:' || regexp_replace(c.cpf, '\D', '', 'g')
      WHEN nullif(regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
        THEN 'doc:' || regexp_replace(c.cnpj, '\D', '', 'g')
      WHEN public.consorcio_pessoa_nome_key(c.nome_completo) IS NOT NULL
        THEN 'nome:' || public.consorcio_pessoa_nome_key(c.nome_completo)
      ELSE 'card:' || c.id::text
    END AS pessoa
  FROM residuo c
  LEFT JOIN nome_closer nc ON nc.nk = public.consorcio_name_key(c.vendedor_name)
),
vendas AS (
  SELECT closer_key, 'B' AS perna, count(*)::int AS vendas FROM pessoas_b GROUP BY 1
  UNION ALL
  SELECT closer_key, 'C', count(*)::int FROM pessoas_c GROUP BY 1
),
retro_agg AS (
  SELECT coalesce(nc.closer_id::text, '__sem__') AS closer_key,
         count(*)::int AS qtd,
         sum(r.valor_credito) AS credito,
         array_agg(DISTINCT to_char(r.aceite_date, 'YYYY-MM')) AS meses
  FROM retro_avulsos r
  LEFT JOIN nome_closer nc ON nc.nk = public.consorcio_name_key(r.vend)
  GROUP BY 1
),
-- ══ Agregações finais
por_key AS (
  SELECT closer_key,
         sum(credito) AS credito,
         sum(cartas)::int AS cartas,
         sum(vendas_a)::int AS vendas_a,
         sum(antedatados)::int AS antedatados,
         sum(antedatados_credito) AS antedatados_credito
  FROM linhas GROUP BY 1
),
por_key_full AS (
  SELECT k.closer_key,
         coalesce(p.credito, 0) AS credito,
         coalesce(p.cartas, 0) AS cartas,
         coalesce(p.vendas_a, 0) + coalesce((SELECT sum(v.vendas) FROM vendas v WHERE v.closer_key = k.closer_key), 0) AS vendas,
         coalesce(p.antedatados, 0) AS antedatados,
         coalesce(p.antedatados_credito, 0) AS antedatados_credito,
         coalesce(rt.qtd, 0) AS lancados_retroativos,
         coalesce(rt.credito, 0) AS lancados_retroativos_credito,
         coalesce(rt.meses, ARRAY[]::text[]) AS lancados_retroativos_meses
  FROM (
    SELECT closer_key FROM por_key
    UNION SELECT closer_key FROM vendas
    UNION SELECT closer_key FROM retro_agg
  ) k
  LEFT JOIN por_key p ON p.closer_key = k.closer_key
  LEFT JOIN retro_agg rt ON rt.closer_key = k.closer_key
),
pernas AS (
  SELECT l.perna,
         sum(l.credito) AS credito,
         sum(l.cartas)::int AS cartas,
         sum(l.vendas_a)::int AS vendas_a,
         sum(l.antedatados)::int AS antedatados,
         sum(l.antedatados_credito) AS antedatados_credito
  FROM linhas l GROUP BY 1
),
pernas_full AS (
  SELECT pn.perna,
         pn.credito, pn.cartas,
         pn.vendas_a + coalesce((SELECT sum(v.vendas) FROM vendas v WHERE v.perna = pn.perna), 0) AS vendas,
         pn.antedatados, pn.antedatados_credito
  FROM pernas pn
)
SELECT jsonb_build_object(
  'periodo', jsonb_build_object('ini', p_ini, 'fim', p_fim, 'bu', p_bu),
  'total', (
    SELECT jsonb_build_object(
      'credito', coalesce(sum(credito), 0),
      'cartas', coalesce(sum(cartas), 0),
      'vendas', coalesce(sum(vendas), 0),
      'antedatados', coalesce(sum(antedatados), 0),
      'antedatados_credito', coalesce(sum(antedatados_credito), 0),
      'lancados_retroativos', coalesce(sum(lancados_retroativos), 0),
      'lancados_retroativos_credito', coalesce(sum(lancados_retroativos_credito), 0)
    ) FROM por_key_full
  ),
  'sem_atribuicao', (
    SELECT coalesce(jsonb_build_object(
      'credito', credito, 'cartas', cartas, 'vendas', vendas,
      'antedatados', antedatados, 'antedatados_credito', antedatados_credito,
      'lancados_retroativos', lancados_retroativos,
      'lancados_retroativos_credito', lancados_retroativos_credito
    ), '{}'::jsonb)
    FROM por_key_full WHERE closer_key = '__sem__'
  ),
  'por_closer', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'closer_id', f.closer_key,
      'nome', cl.name,
      'credito', f.credito,
      'cartas', f.cartas,
      'vendas', f.vendas,
      'antedatados', f.antedatados,
      'antedatados_credito', f.antedatados_credito,
      'lancados_retroativos', f.lancados_retroativos,
      'lancados_retroativos_credito', f.lancados_retroativos_credito,
      'lancados_retroativos_meses', f.lancados_retroativos_meses
    ) ORDER BY f.credito DESC)
    FROM por_key_full f
    LEFT JOIN public.closers cl ON cl.id::text = f.closer_key
    WHERE f.closer_key <> '__sem__'
  ), '[]'::jsonb),
  'pernas', (
    SELECT coalesce(jsonb_object_agg(lower(perna), jsonb_build_object(
      'credito', credito, 'cartas', cartas, 'vendas', vendas,
      'antedatados', antedatados, 'antedatados_credito', antedatados_credito
    )), '{}'::jsonb) FROM pernas_full
  )
);
$$;

REVOKE ALL ON FUNCTION public.consorcio_producao_gerada(date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consorcio_producao_gerada(date, date, text) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Snapshots do relatório diário (formato longo). Nasce vazia.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.relatorio_diario_snapshots (
  data date NOT NULL,
  bu text NOT NULL,
  metrica text NOT NULL,
  valor numeric NULL,
  status text NOT NULL DEFAULT 'ok',
  gerado_em timestamptz NOT NULL DEFAULT now(),
  revisao int NOT NULL DEFAULT 1,
  PRIMARY KEY (data, bu, metrica)
);

GRANT SELECT ON public.relatorio_diario_snapshots TO authenticated;
GRANT ALL ON public.relatorio_diario_snapshots TO service_role;

ALTER TABLE public.relatorio_diario_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestao le snapshots do relatorio diario"
ON public.relatorio_diario_snapshots
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'coordenador')
);