CREATE OR REPLACE FUNCTION public._c360_ident(_contact_id uuid)
RETURNS TABLE(contact_ids uuid[], emails text[], phones text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH base AS (SELECT lower(trim(email)) e, right(regexp_replace(coalesce(phone,''),'\D','','g'),9) p FROM crm_contacts WHERE id=_contact_id),
  cs AS (
    SELECT c.id, lower(trim(c.email)) e, right(regexp_replace(coalesce(c.phone,''),'\D','','g'),9) p
    FROM crm_contacts c, base b
    WHERE c.id=_contact_id
       OR (b.e IS NOT NULL AND b.e<>'' AND lower(trim(c.email))=b.e)
       OR (length(b.p)=9 AND right(regexp_replace(coalesce(c.phone,''),'\D','','g'),9)=b.p))
  SELECT array_agg(DISTINCT id), array_remove(array_agg(DISTINCT nullif(e,'')),NULL), array_remove(array_agg(DISTINCT CASE WHEN length(p)=9 THEN p END),NULL) FROM cs
$$;
REVOKE EXECUTE ON FUNCTION public._c360_ident(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._c360_pode_ver(_ids uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'gerente_relacionamento')
   OR EXISTS (SELECT 1 FROM crm_deals d WHERE d.contact_id=ANY(_ids) AND d.owner_profile_id=auth.uid())
   OR EXISTS (SELECT 1 FROM meeting_slot_attendees a JOIN meeting_slots s ON s.id=a.meeting_slot_id
              LEFT JOIN closers cl ON cl.id=s.closer_id LEFT JOIN profiles pr ON pr.id=auth.uid()
              WHERE a.contact_id=ANY(_ids) AND (a.booked_by=auth.uid() OR (cl.email IS NOT NULL AND lower(cl.email)=lower(pr.email))))
$$;
REVOKE EXECUTE ON FUNCTION public._c360_pode_ver(uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cliente_timeline(_contact_id uuid)
RETURNS TABLE(ts timestamptz, tipo text, bu text, titulo text, detalhe text, ator text, deal_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ids uuid[]; v_em text[]; v_ph text[];
BEGIN
  SELECT i.contact_ids,i.emails,i.phones INTO v_ids,v_em,v_ph FROM _c360_ident(_contact_id) i;
  IF v_ids IS NULL OR NOT _c360_pode_ver(v_ids) THEN RAISE EXCEPTION 'sem_permissao: Você não tem acesso a este cliente.'; END IF;
  RETURN QUERY
  WITH deals AS (SELECT d.id,d.created_at,d.origin_id,d.owner_profile_id,o.display_name,o.name oname FROM crm_deals d LEFT JOIN crm_origins o ON o.id=d.origin_id WHERE d.contact_id=ANY(v_ids))
  SELECT d.created_at,'lead','CRM','Entrada como lead', coalesce(d.display_name,d.oname), (SELECT full_name FROM profiles WHERE id=d.owner_profile_id), d.id FROM deals d
  UNION ALL
  SELECT a.created_at, CASE WHEN a.activity_type ILIKE '%stage%' THEN 'etapa' ELSE 'atividade' END, 'CRM',
         CASE WHEN a.to_stage IS NOT NULL THEN 'Mudou de etapa' ELSE coalesce(initcap(replace(a.activity_type,'_',' ')),'Atividade') END,
         CASE WHEN a.to_stage IS NOT NULL THEN coalesce(a.from_stage,'—')||' → '||a.to_stage ELSE left(a.description,300) END,
         (SELECT full_name FROM profiles WHERE id=a.user_id), a.deal_id
  FROM deal_activities a WHERE a.deal_id IN (SELECT id FROM deals)
  UNION ALL
  SELECT coalesce(c.started_at,c.created_at),'ligacao','CRM','Ligação '||coalesce(c.outcome,c.status,''), left(coalesce(c.ai_summary,c.summary,c.notes),300),(SELECT full_name FROM profiles WHERE id=c.user_id), c.deal_id
  FROM calls c WHERE c.contact_id=ANY(v_ids) OR c.deal_id IN (SELECT id FROM deals)
  UNION ALL
  SELECT s.scheduled_at,'reuniao','Agenda', upper(coalesce(s.meeting_type,'r1'))||' · '||coalesce(a.status,s.status),
         'Closer: '||coalesce(cl.name,'—'), (SELECT full_name FROM profiles WHERE id=a.booked_by), a.deal_id
  FROM meeting_slot_attendees a JOIN meeting_slots s ON s.id=a.meeting_slot_id LEFT JOIN closers cl ON cl.id=s.closer_id
  WHERE a.contact_id=ANY(v_ids) OR a.deal_id IN (SELECT id FROM deals)
  UNION ALL
  SELECT a.contract_paid_at,'contrato','Incorporador','Contrato A000 pago', 'Closer: '||coalesce(cl.name,'—'), NULL, a.deal_id
  FROM meeting_slot_attendees a JOIN meeting_slots s ON s.id=a.meeting_slot_id LEFT JOIN closers cl ON cl.id=s.closer_id
  WHERE a.contract_paid_at IS NOT NULL AND (a.contact_id=ANY(v_ids) OR a.deal_id IN (SELECT id FROM deals))
  UNION ALL
  SELECT h.sale_date, CASE WHEN h.sale_status='refunded' THEN 'reembolso' ELSE 'venda' END, 'Incorporador',
         CASE WHEN h.sale_status='refunded' THEN 'Reembolso · ' ELSE 'Compra · ' END||coalesce(h.product_name,''),
         coalesce(h.source,'')||' · bruto '||to_char(coalesce(h.gross_override,h.product_price,0),'FM999G999G990D00'), NULL, h.linked_deal_id
  FROM hubla_transactions h
  WHERE (lower(trim(h.customer_email))=ANY(v_em) OR right(regexp_replace(coalesce(h.customer_phone,''),'\D','','g'),9)=ANY(v_ph))
    AND coalesce(h.installment_number,1)<=1 AND h.sale_date IS NOT NULL
  UNION ALL
  SELECT t.created_at, t.evento, 'Pós Venda',
         CASE t.evento WHEN 'entrada' THEN 'Entrada no Pós Venda' ELSE initcap(replace(t.evento,'_',' ')) END,
         concat_ws(' · ', nullif(concat_ws(' → ',t.origin_de,t.origin_para),''), nullif(concat_ws(' → ',t.stage_de,t.stage_para),''), t.nota),
         (SELECT full_name FROM profiles WHERE id=t.actor_id), t.deal_id
  FROM crm_cliente_timeline t WHERE t.contact_id=ANY(v_ids) OR t.deal_id IN (SELECT id FROM deals)
  UNION ALL
  SELECT coalesce(cc.data_contratacao::timestamptz,cc.created_at),'consorcio','Consórcio','Cota de consórcio · '||coalesce(cc.status,''),
         'Grupo '||coalesce(cc.grupo,'—')||' cota '||coalesce(cc.cota,'—')||' · crédito '||to_char(coalesce(cc.valor_credito,0),'FM999G999G990D00'), cc.vendedor_name, NULL
  FROM consortium_cards cc WHERE lower(trim(cc.email))=ANY(v_em) OR right(regexp_replace(coalesce(cc.telefone,''),'\D','','g'),9)=ANY(v_ph)
  UNION ALL
  SELECT coalesce(cv.data_assinatura::timestamptz,cv.created_at),'credito','Crédito','Operação de crédito · '||coalesce(cv.status,''),
         concat_ws(' · ',cv.banco,cv.modalidade,to_char(coalesce(cv.valor_credito,0),'FM999G999G990D00')), NULL, cv.deal_id
  FROM credito_vendas cv WHERE cv.contact_id=ANY(v_ids) OR cv.deal_id IN (SELECT id FROM deals);
END $$;

CREATE OR REPLACE FUNCTION public.cliente_360(_contact_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ids uuid[]; v_em text[]; v_ph text[]; r jsonb;
BEGIN
  SELECT i.contact_ids,i.emails,i.phones INTO v_ids,v_em,v_ph FROM _c360_ident(_contact_id) i;
  IF v_ids IS NULL OR NOT _c360_pode_ver(v_ids) THEN RAISE EXCEPTION 'sem_permissao: Você não tem acesso a este cliente.'; END IF;
  WITH tit AS (
    SELECT t.id,t.product_code,t.product_name,t.sale_date,t.status,
      greatest(coalesce(t.valor_total,0),coalesce((SELECT sum(p.valor) FROM ar_parcelas p WHERE p.titulo_id=t.id AND p.status<>'cancelado'),0)) contratado,
      (SELECT coalesce(sum(coalesce(p.valor_pago,p.valor)),0) FROM ar_parcelas p WHERE p.titulo_id=t.id AND p.data_pagamento IS NOT NULL) pago,
      (SELECT count(*) FROM ar_parcelas p WHERE p.titulo_id=t.id AND p.status<>'cancelado') n_parc,
      (SELECT count(*) FROM ar_parcelas p WHERE p.titulo_id=t.id AND p.data_pagamento IS NOT NULL) n_pagas,
      (SELECT count(*) FROM ar_parcelas p WHERE p.titulo_id=t.id AND p.data_pagamento IS NULL AND p.status<>'cancelado' AND p.data_vencimento<current_date) n_atras,
      (SELECT min(p.data_vencimento) FROM ar_parcelas p WHERE p.titulo_id=t.id AND p.data_pagamento IS NULL AND p.status<>'cancelado' AND p.data_vencimento>=current_date) prox,
      EXISTS (SELECT 1 FROM ar_reembolsos rr WHERE rr.titulo_id=t.id) reembolsado
    FROM ar_titulos t WHERE lower(trim(t.customer_email))=ANY(v_em) OR right(regexp_replace(coalesce(t.customer_phone,''),'\D','','g'),9)=ANY(v_ph)),
  cot AS (
    SELECT cc.id,cc.grupo,cc.cota,cc.valor_credito,cc.status,cc.data_contratacao,
      (SELECT count(*) FROM consortium_installments i WHERE i.card_id=cc.id AND i.data_pagamento IS NOT NULL) n_pagas,
      (SELECT count(*) FROM consortium_installments i WHERE i.card_id=cc.id AND i.data_pagamento IS NULL AND i.data_vencimento<current_date) n_atras,
      (SELECT min(i.data_vencimento) FROM consortium_installments i WHERE i.card_id=cc.id AND i.data_pagamento IS NULL AND i.data_vencimento>=current_date) prox
    FROM consortium_cards cc WHERE lower(trim(cc.email))=ANY(v_em) OR right(regexp_replace(coalesce(cc.telefone,''),'\D','','g'),9)=ANY(v_ph)),
  cred AS (SELECT * FROM credito_vendas WHERE contact_id=ANY(v_ids) AND cancelado_em IS NULL),
  pv AS (SELECT d.id, s.stage_name, (SELECT full_name FROM profiles WHERE id=d.owner_profile_id) gerente
         FROM crm_deals d JOIN crm_origins o ON o.id=d.origin_id LEFT JOIN crm_stages s ON s.id=d.stage_id
         WHERE d.contact_id=ANY(v_ids) AND o.name ILIKE '%pós venda%' ORDER BY d.created_at DESC LIMIT 1),
  r1 AS (SELECT (SELECT full_name FROM profiles WHERE id=a.booked_by) sdr, cl.name closer FROM meeting_slot_attendees a JOIN meeting_slots s ON s.id=a.meeting_slot_id LEFT JOIN closers cl ON cl.id=s.closer_id
         WHERE a.contact_id=ANY(v_ids) AND coalesce(s.meeting_type,'r1') ILIKE 'r1%' ORDER BY s.scheduled_at DESC LIMIT 1)
  SELECT jsonb_build_object(
    'contato', (SELECT to_jsonb(c) - 'custom_fields' FROM (SELECT id,name,email,phone,created_at,tags FROM crm_contacts WHERE id=_contact_id) c),
    'registros_unificados', array_length(v_ids,1),
    'primeiro_contato', (SELECT min(created_at) FROM crm_deals WHERE contact_id=ANY(v_ids)),
    'primeira_compra', (SELECT min(sale_date) FROM tit),
    'sdr', (SELECT sdr FROM r1), 'closer', (SELECT closer FROM r1),
    'pos_venda', (SELECT to_jsonb(pv) FROM pv),
    'titulos', coalesce((SELECT jsonb_agg(to_jsonb(tit) ORDER BY sale_date) FROM tit),'[]'),
    'cotas', coalesce((SELECT jsonb_agg(to_jsonb(cot) ORDER BY data_contratacao) FROM cot),'[]'),
    'creditos', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'banco',banco,'modalidade',modalidade,'valor_credito',valor_credito,'status',status,'data_assinatura',data_assinatura)) FROM cred),'[]')
  ) INTO r;
  RETURN r;
END $$;

REVOKE EXECUTE ON FUNCTION public.cliente_360(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cliente_timeline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cliente_360(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cliente_timeline(uuid) TO authenticated;