CREATE OR REPLACE FUNCTION public.sugerir_vinculo_contrato(
  p_ini date,
  p_fim date,
  p_bu  text DEFAULT 'incorporador'
)
RETURNS TABLE(
  transaction_id uuid,
  customer_name text,
  valor numeric,
  sale_date timestamptz,
  deal_id uuid,
  attendee_id uuid,
  closer_id uuid,
  closer_name text,
  meeting_type text,
  scheduled_at timestamptz,
  status_attendee text,
  criterio text,
  forca text,
  r1_antes_do_pagamento boolean,
  qtd_candidatos integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH orf AS MATERIALIZED (
  SELECT
    ht.id            AS tx_id,
    ht.customer_name AS cust_name,
    COALESCE(ht.net_value, ht.product_price) AS valor,
    ht.sale_date,
    ht.linked_deal_id,
    NULLIF(regexp_replace(COALESCE(ht.customer_document, ''), '\D', '', 'g'), '') AS doc,
    lower(NULLIF(btrim(COALESCE(ht.customer_email, '')), '')) AS email,
    NULLIF(right(regexp_replace(COALESCE(ht.customer_phone, ''), '\D', '', 'g'), 9), '') AS phone9,
    NULLIF(btrim(regexp_replace(
      upper(translate(COALESCE(ht.customer_name, ''),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')),
      '\s+', ' ', 'g')), '') AS nome
  FROM hubla_transactions ht
  WHERE (
        upper(COALESCE(ht.product_code, '')) LIKE 'A000%'
     OR upper(COALESCE(ht.product_name, '')) LIKE '%A000%'
     OR upper(COALESCE(ht.product_name, '')) LIKE '%CONTRATO%'
  )
    AND lower(COALESCE(ht.sale_status, '')) IN ('pago', 'paid', 'approved', 'completed')
    AND ht.linked_attendee_id IS NULL
    AND ht.sale_date IS NOT NULL
    AND (ht.sale_date AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
),
cont AS MATERIALIZED (
  SELECT
    cc.id,
    NULLIF(regexp_replace(COALESCE(cc.custom_fields->>'cpf', cc.custom_fields->>'cpf_cnpj', cc.custom_fields->>'documento', ''), '\D', '', 'g'), '') AS doc,
    lower(NULLIF(btrim(COALESCE(cc.email, '')), '')) AS email,
    NULLIF(right(regexp_replace(COALESCE(cc.phone, ''), '\D', '', 'g'), 9), '') AS phone9,
    NULLIF(btrim(regexp_replace(
      upper(translate(COALESCE(cc.name, ''),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')),
      '\s+', ' ', 'g')), '') AS nome
  FROM crm_contacts cc
  WHERE cc.merged_into_contact_id IS NULL
    AND (
      lower(NULLIF(btrim(COALESCE(cc.email, '')), '')) IN (SELECT email FROM orf WHERE email IS NOT NULL)
      OR NULLIF(right(regexp_replace(COALESCE(cc.phone, ''), '\D', '', 'g'), 9), '') IN (SELECT phone9 FROM orf WHERE phone9 IS NOT NULL)
      OR NULLIF(btrim(regexp_replace(upper(translate(COALESCE(cc.name, ''),
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
           'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')), '\s+', ' ', 'g')), '')
         IN (SELECT nome FROM orf WHERE nome IS NOT NULL)
      OR split_part(NULLIF(btrim(regexp_replace(upper(translate(COALESCE(cc.name, ''),
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
           'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')), '\s+', ' ', 'g')), ''), ' ', 1)
         || ' ' ||
         split_part(NULLIF(btrim(regexp_replace(upper(translate(COALESCE(cc.name, ''),
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
           'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')), '\s+', ' ', 'g')), ''), ' ', 2)
         IN (SELECT split_part(nome, ' ', 1) || ' ' || split_part(nome, ' ', 2) FROM orf WHERE nome IS NOT NULL AND split_part(nome, ' ', 2) <> '')
      OR NULLIF(regexp_replace(COALESCE(cc.custom_fields->>'cpf', cc.custom_fields->>'cpf_cnpj', cc.custom_fields->>'documento', ''), '\D', '', 'g'), '')
         IN (SELECT doc FROM orf WHERE doc IS NOT NULL)
    )
),
cand_raw AS MATERIALIZED (
  -- nivel 0: vinculo de negocio ja gravado na transacao
  SELECT o.tx_id, o.linked_deal_id AS deal_id, 'deal vinculado'::text AS criterio, 'forte'::text AS forca, 0 AS nivel
  FROM orf o WHERE o.linked_deal_id IS NOT NULL
  UNION ALL
  -- nivel 1: documento
  SELECT o.tx_id, d.id, 'documento', 'forte', 1
  FROM orf o JOIN cont c ON c.doc IS NOT NULL AND c.doc = o.doc
             JOIN crm_deals d ON d.contact_id = c.id
  UNION ALL
  -- nivel 2: e-mail (contato)
  SELECT o.tx_id, d.id, 'e-mail', 'forte', 2
  FROM orf o JOIN cont c ON c.email IS NOT NULL AND c.email = o.email
             JOIN crm_deals d ON d.contact_id = c.id
  UNION ALL
  -- nivel 2: e-mail (custom_fields do negocio)
  SELECT o.tx_id, d.id, 'e-mail', 'forte', 2
  FROM orf o JOIN crm_deals d ON lower(NULLIF(btrim(COALESCE(d.custom_fields->>'email', '')), '')) = o.email
  WHERE o.email IS NOT NULL
  UNION ALL
  -- nivel 3: telefone (9 digitos)
  SELECT o.tx_id, d.id, 'telefone', 'media', 3
  FROM orf o JOIN cont c ON c.phone9 IS NOT NULL AND c.phone9 = o.phone9
             JOIN crm_deals d ON d.contact_id = c.id
  UNION ALL
  -- nivel 4: nome completo normalizado
  SELECT o.tx_id, d.id, 'nome completo', 'fraca', 4
  FROM orf o JOIN cont c ON c.nome IS NOT NULL AND c.nome = o.nome
             JOIN crm_deals d ON d.contact_id = c.id
  UNION ALL
  -- nivel 5: dois primeiros nomes
  SELECT o.tx_id, d.id, 'dois primeiros nomes', 'fraca', 5
  FROM orf o JOIN cont c ON split_part(c.nome, ' ', 1) = split_part(o.nome, ' ', 1)
                        AND split_part(c.nome, ' ', 2) = split_part(o.nome, ' ', 2)
                        AND split_part(o.nome, ' ', 2) <> ''
             JOIN crm_deals d ON d.contact_id = c.id
  WHERE o.nome IS NOT NULL
),
cand AS MATERIALIZED (
  SELECT DISTINCT ON (tx_id, deal_id) tx_id, deal_id, criterio, forca, nivel
  FROM cand_raw
  WHERE deal_id IS NOT NULL
  ORDER BY tx_id, deal_id, nivel
),
pick AS (
  SELECT
    o.tx_id, o.cust_name, o.valor, o.sale_date,
    c.deal_id, c.criterio, c.forca,
    m.att_id, m.att_status, m.closer_id, m.mtype, m.sched, m.antes,
    cl.name AS closer_name, cl.bu AS closer_bu
  FROM cand c
  JOIN orf o ON o.tx_id = c.tx_id
  LEFT JOIN LATERAL (
    SELECT a.id AS att_id, a.status AS att_status, ms.closer_id,
           ms.meeting_type AS mtype, ms.scheduled_at AS sched,
           (ms.scheduled_at <= o.sale_date) AS antes
    FROM meeting_slot_attendees a
    JOIN meeting_slots ms ON ms.id = a.meeting_slot_id
    WHERE a.deal_id = c.deal_id
      AND ms.meeting_type = 'r1'
      AND a.status NOT IN ('cancelled', 'rescheduled')
    ORDER BY (ms.scheduled_at <= o.sale_date) DESC,
             abs(extract(epoch FROM (ms.scheduled_at - o.sale_date))) ASC
    LIMIT 1
  ) m ON true
  LEFT JOIN closers cl ON cl.id = m.closer_id
)
SELECT
  p.tx_id, p.cust_name, p.valor, p.sale_date,
  p.deal_id, p.att_id, p.closer_id, p.closer_name,
  p.mtype, p.sched, p.att_status,
  p.criterio, p.forca, COALESCE(p.antes, false),
  count(*) OVER (PARTITION BY p.tx_id)::int
FROM pick p
WHERE p.att_id IS NOT NULL
  AND (p_bu IS NULL OR p.closer_bu IS NULL OR p.closer_bu = p_bu)
ORDER BY p.tx_id, p.criterio, p.sched DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.sugerir_vinculo_contrato(date, date, text) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_msa_deal_status ON public.meeting_slot_attendees (deal_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON public.crm_deals (contact_id);