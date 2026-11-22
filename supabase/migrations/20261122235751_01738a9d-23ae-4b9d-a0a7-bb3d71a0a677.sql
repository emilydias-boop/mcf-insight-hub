CREATE OR REPLACE FUNCTION public.outside_fora_do_funil(p_from date, p_to date)
 RETURNS TABLE(transaction_id uuid, customer_email text, customer_name text, offer_name text, source text, contrato_em timestamp with time zone, net_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- ATENÇÃO: a regra de "primeira compra" abaixo é a MESMA de get_first_transaction_ids(),
-- limitada às chaves de produto que existem em vendas de contrato (evita calcular todos os produtos).
-- Se a regra mudar em get_first_transaction_ids(), mudar aqui também.
WITH candidatas AS MATERIALIZED (
  SELECT t.id, lower(trim(t.customer_email)) AS customer_email, t.customer_name, t.offer_name, t.source, t.sale_date, t.net_value
  FROM hubla_transactions t
  WHERE t.sale_status = 'completed'
    AND t.product_category IN ('contrato', 'incorporador')
    AND t.product_name ILIKE '%contrato%'
    AND t.sale_date >= (p_from::timestamp + INTERVAL '3 hours')
    AND t.sale_date <  ((p_to + 1)::timestamp + INTERVAL '3 hours')
    AND lower(COALESCE(t.source, '')) <> 'mcfpay'
    AND COALESCE(t.offer_name, '') NOT ILIKE '%CLS%'
    AND COALESCE(t.offer_name, '') NOT ILIKE '%cio MCF%'
),
parent_ids AS MATERIALIZED (
  SELECT DISTINCT split_part(h0.hubla_id, '-offer-', 1) AS parent_id FROM hubla_transactions h0 WHERE h0.hubla_id LIKE '%-offer-%'
),
mapa AS MATERIALIZED (
  SELECT n.product_name,
    EXISTS (SELECT 1 FROM product_configurations pc WHERE lower(pc.product_name) = lower(n.product_name) AND pc.target_bu = 'incorporador' AND pc.is_active = true) AS incorp,
    (lower(n.product_name) IN ('parceria','contrato','ob construir para alugar')) AS make_excluido,
    CASE
      WHEN upper(n.product_name) LIKE '%A009%' THEN 'A009'
      WHEN upper(n.product_name) LIKE '%A005%' THEN 'A005'
      WHEN upper(n.product_name) LIKE '%A004%' THEN 'A004'
      WHEN upper(n.product_name) LIKE '%A003%' THEN 'A003'
      WHEN upper(n.product_name) LIKE '%A001%' THEN 'A001'
      WHEN upper(n.product_name) LIKE '%A010%' THEN 'A010'
      WHEN upper(n.product_name) LIKE '%A000%' OR upper(n.product_name) LIKE '%CONTRATO%' THEN 'A000'
      WHEN upper(n.product_name) LIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
      ELSE left(upper(trim(n.product_name)), 40)
    END AS product_key
  FROM (SELECT DISTINCT hn.product_name FROM hubla_transactions hn) n
),
incorp_parents AS MATERIALIZED (
  SELECT DISTINCT h.hubla_id AS parent_id FROM hubla_transactions h JOIN mapa m ON m.product_name = h.product_name
  WHERE m.incorp AND h.hubla_id NOT LIKE '%-offer-%' AND h.hubla_id IN (SELECT pi.parent_id FROM parent_ids pi)
),
base0 AS MATERIALIZED (
  SELECT ht.id, ht.sale_date,
    (ht.dedupe_reason IS NOT NULL OR COALESCE(ht.is_hubla_cart_row, false)) AS eh_duplicata,
    COALESCE(ht.net_value, 0) AS liquido,
    lower(COALESCE(NULLIF(trim(ht.customer_email), ''), 'unknown')) AS email_key,
    m.product_key,
    CASE WHEN ht.source IN ('make','manual') THEN 'legado' ELSE ht.source END AS source_key,
    CASE ht.source WHEN 'hubla' THEN 1 WHEN 'manual' THEN 2 WHEN 'mcfpay' THEN 3 WHEN 'kiwify' THEN 4 ELSE 5 END AS source_prio
  FROM hubla_transactions ht JOIN mapa m ON m.product_name = ht.product_name
  WHERE ht.sale_status = 'completed'
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND ht.source IN ('hubla','manual','make','mcfpay','kiwify')
    AND NOT (ht.source = 'make' AND ht.sale_date >= '2026-04-01T00:00:00-03:00'::timestamptz)
    AND NOT (ht.hubla_id IN (SELECT pi.parent_id FROM parent_ids pi) AND (ht.is_hubla_cart_row OR COALESCE(ht.net_value, 0) <= 0))
    AND NOT (ht.source = 'make' AND m.make_excluido)
    AND (m.incorp OR (ht.hubla_id LIKE '%-offer-%' AND split_part(ht.hubla_id, '-offer-', 1) IN (SELECT ip.parent_id FROM incorp_parents ip)))
    AND m.product_key IN (SELECT DISTINCT m3.product_key FROM mapa m3 WHERE m3.product_name ILIKE '%contrato%')
),
base AS (
  SELECT b0.*, COALESCE(vd.dono_key, 'e:' || b0.email_key) AS dono_key
  FROM base0 b0 LEFT JOIN vw_venda_dono vd ON vd.venda_id = b0.id
),
ranked AS (
  SELECT b.id, b.sale_date,
    row_number() OVER (PARTITION BY b.email_key COLLATE "C", b.product_key COLLATE "C", b.source_key COLLATE "C" ORDER BY b.sale_date, b.source_prio, b.eh_duplicata, b.liquido DESC, b.id) AS rn_por_fonte,
    row_number() OVER (PARTITION BY b.dono_key COLLATE "C", b.product_key COLLATE "C" ORDER BY b.sale_date, b.source_prio, b.eh_duplicata, b.liquido DESC, b.id) AS rn_geral
  FROM base b
),
primeiras AS (
  SELECT r.id FROM ranked r
  WHERE CASE WHEN r.sale_date < '2026-04-01T00:00:00-03:00'::timestamptz THEN r.rn_por_fonte = 1 ELSE r.rn_geral = 1 END
)
SELECT c.id, c.customer_email, c.customer_name, c.offer_name, c.source, c.sale_date, c.net_value
FROM candidatas c
WHERE c.id IN (SELECT p.id FROM primeiras p);
$function$;