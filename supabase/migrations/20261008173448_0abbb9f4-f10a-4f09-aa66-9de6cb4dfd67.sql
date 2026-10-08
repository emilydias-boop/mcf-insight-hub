CREATE OR REPLACE FUNCTION public.consorcio_vendas_realizadas(p_ini date, p_fim date, p_bu text DEFAULT 'consorcio')
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- VENDAS REALIZADAS (Consórcio): clientes distintos × mês da âncora na MESMA
-- base da consorcio_producao_gerada (pernas A+B+C, mesmos filtros e dedup).
WITH props AS (
  SELECT p.id, p.deal_id, coalesce(p.aceite_date, p.proposal_date) AS ancora
  FROM public.consorcio_proposals p
  WHERE p.status = 'aceita' AND p.deleted_at IS NULL
    AND coalesce(p.carta_excluida, false) = false
    AND coalesce(p.aceite_date, p.proposal_date) BETWEEN p_ini AND p_fim
    AND EXISTS (SELECT 1 FROM public.consorcio_proposal_cartas k WHERE k.proposal_id = p.id)
),
cad_prop AS (
  SELECT DISTINCT ON (r.proposal_id) r.proposal_id, r.cpf, r.cnpj, r.nome_completo
  FROM public.consorcio_pending_registrations r
  JOIN props pr ON pr.id = r.proposal_id
  ORDER BY r.proposal_id, r.created_at ASC
),
perna_a AS (
  SELECT coalesce(
           CASE
             WHEN nullif(regexp_replace(coalesce(cp.cpf, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(cp.cpf, '\D', '', 'g')
             WHEN nullif(regexp_replace(coalesce(cp.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(cp.cnpj, '\D', '', 'g')
             WHEN public.consorcio_pessoa_nome_key(cp.nome_completo) IS NOT NULL THEN 'nome:' || public.consorcio_pessoa_nome_key(cp.nome_completo)
           END,
           'contato:' || d.contact_id::text, 'deal:' || pr.deal_id::text, 'proposta:' || pr.id::text) AS pessoa,
         to_char(pr.ancora, 'YYYY-MM') AS mes
  FROM props pr
  LEFT JOIN cad_prop cp ON cp.proposal_id = pr.id
  LEFT JOIN public.crm_deals d ON d.id = pr.deal_id
),
regs AS (SELECT r.* FROM public.consorcio_pending_registrations r WHERE r.aceite_date BETWEEN p_ini AND p_fim),
cards_c AS (SELECT c.* FROM public.consortium_cards c WHERE c.tipo_registro = 'contratacao' AND c.data_contratacao BETWEEN p_ini AND p_fim),
cand_cards AS (
  SELECT DISTINCT consortium_card_id AS cid FROM regs WHERE consortium_card_id IS NOT NULL
  UNION SELECT id FROM cards_c
),
cards_vinc AS (
  SELECT cc.cid FROM cand_cards cc
  WHERE EXISTS (SELECT 1 FROM public.consorcio_proposals p WHERE p.consortium_card_id = cc.cid)
     OR EXISTS (SELECT 1 FROM public.consorcio_proposal_cartas k WHERE k.consortium_card_id = cc.cid)
     OR EXISTS (SELECT 1 FROM public.consorcio_pending_registrations r WHERE r.consortium_card_id = cc.cid AND r.proposal_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.consorcio_pending_registrations r
                JOIN public.consorcio_proposal_cartas k2 ON k2.pending_registration_id = r.id
                WHERE r.consortium_card_id = cc.cid)
),
perna_b AS (
  SELECT CASE
           WHEN nullif(regexp_replace(coalesce(b.cpf, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(b.cpf, '\D', '', 'g')
           WHEN nullif(regexp_replace(coalesce(b.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(b.cnpj, '\D', '', 'g')
           WHEN public.consorcio_pessoa_nome_key(coalesce(b.nome_completo, b.razao_social)) IS NOT NULL
             THEN 'nome:' || public.consorcio_pessoa_nome_key(coalesce(b.nome_completo, b.razao_social))
           ELSE 'card:' || b.id::text
         END AS pessoa,
         to_char(b.aceite_date, 'YYYY-MM') AS mes
  FROM regs b
  WHERE b.proposal_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.consorcio_proposal_cartas k WHERE k.pending_registration_id = b.id)
    AND (b.consortium_card_id IS NULL OR b.consortium_card_id NOT IN (SELECT cid FROM cards_vinc))
),
perna_c AS (
  SELECT CASE
           WHEN nullif(regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(c.cpf, '\D', '', 'g')
           WHEN nullif(regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL THEN 'doc:' || regexp_replace(c.cnpj, '\D', '', 'g')
           WHEN public.consorcio_pessoa_nome_key(c.nome_completo) IS NOT NULL THEN 'nome:' || public.consorcio_pessoa_nome_key(c.nome_completo)
           ELSE 'card:' || c.id::text
         END AS pessoa,
         to_char(c.data_contratacao, 'YYYY-MM') AS mes
  FROM cards_c c
  WHERE NOT EXISTS (SELECT 1 FROM public.consorcio_pending_registrations r WHERE r.consortium_card_id = c.id)
    AND c.id NOT IN (SELECT cid FROM cards_vinc)
)
SELECT count(*)::int FROM (
  SELECT pessoa, mes FROM perna_a
  UNION SELECT pessoa, mes FROM perna_b
  UNION SELECT pessoa, mes FROM perna_c
) v;
$function$;

GRANT EXECUTE ON FUNCTION public.consorcio_vendas_realizadas(date, date, text) TO authenticated, service_role;

DO $mig$
DECLARE
  s text; a text; b text;
  n int;
BEGIN
  -- relatorio_diario_bu
  s := pg_get_functiondef('public.relatorio_diario_bu(date)'::regprocedure);
  a := '(SELECT venda_realizada FROM cons_cards_agg), ''ok'', ''nao_somavel''';
  b := '(SELECT public.consorcio_vendas_realizadas(p_data, p_data, ''consorcio'')::numeric), ''ok'', ''nao_somavel''';
  n := (length(s) - length(replace(s, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'bu venda: % ocorrencias', n; END IF;
  s := replace(s, a, b);
  a := '(SELECT consorcios_efetivados / nullif(venda_realizada, 0) FROM cons_cards_agg)';
  b := '(SELECT (SELECT credito FROM cons_prod_v) / nullif(public.consorcio_vendas_realizadas(p_data, p_data, ''consorcio'')::numeric, 0))';
  n := (length(s) - length(replace(s, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'bu ticket: % ocorrencias', n; END IF;
  s := replace(s, a, b);
  s := replace(s, '-- (credito efetivado / clientes distintos). Dia sem contratacao -> NULL', '-- (Producao Gerada / Vendas Realizadas, mesma base). Dia sem venda -> NULL');
  EXECUTE s;

  -- relatorio_diario_operacoes
  s := pg_get_functiondef('public.relatorio_diario_operacoes(date)'::regprocedure);
  a := 'WHERE c.tipo_registro = ''contratacao'' AND c.data_contratacao BETWEEN v_ini AND p_data;';
  n := (length(s) - length(replace(s, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'op cotas: % ocorrencias', n; END IF;
  s := replace(s, a, a || E'\n  -- Vendas Realizadas: mesma base da Producao Gerada (pernas A+B+C, cliente x mes)\n  c_vend_m := public.consorcio_vendas_realizadas(v_ini, p_data, ''consorcio'');');
  a := '''nao_somavel'', ''clientes distintos'')';
  n := (length(s) - length(replace(s, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'op nota: % ocorrencias', n; END IF;
  s := replace(s, a, '''nao_somavel'', ''clientes distintos, mesma base da Produção Gerada'')');
  EXECUTE s;
END
$mig$;