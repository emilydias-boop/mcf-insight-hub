CREATE OR REPLACE FUNCTION public.consorcio_resumo_cotas(p_limit integer DEFAULT 50,p_offset integer DEFAULT 0,p_busca text DEFAULT NULL,p_grupo text DEFAULT NULL,p_status text DEFAULT NULL,p_quem_paga text DEFAULT NULL,p_so_atraso boolean DEFAULT false,p_responsavel text DEFAULT NULL)
RETURNS TABLE(card_id uuid,grupo text,cota text,cliente text,status_cota text,responsavel text,prazo integer,parcelas_geradas bigint,ultima_paga integer,vencidas_qtd bigint,vencidas_valor numeric,proxima_numero integer,proxima_vencimento date,proxima_valor numeric,proxima_quem_paga text,mcf_aberto bigint,bloco_atual integer,total bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH cards AS MATERIALIZED (
  SELECT c.id,c.grupo,c.cota,CASE WHEN c.tipo_pessoa='pj' THEN coalesce(c.razao_social,c.nome_completo,'Sem nome') ELSE coalesce(c.nome_completo,'Sem nome') END cliente,c.status,c.vendedor_name,c.prazo_meses
  FROM public.consortium_cards c
  WHERE (nullif(p_busca,'') IS NULL OR concat_ws(' ',c.nome_completo,c.razao_social,c.grupo,c.cota) ILIKE '%'||p_busca||'%')
   AND (nullif(p_grupo,'') IS NULL OR c.grupo=p_grupo) AND (nullif(p_status,'') IS NULL OR c.status=p_status) AND (nullif(p_responsavel,'') IS NULL OR c.vendedor_name ILIKE '%'||p_responsavel||'%')
 ), numbered AS (
  SELECT i.card_id,i.numero_parcela,i.status,i.data_pagamento,i.data_vencimento,i.valor_parcela,i.tipo,row_number() OVER(PARTITION BY i.card_id ORDER BY i.numero_parcela) rn FROM public.consortium_installments i JOIN cards c ON c.id=i.card_id WHERE i.numero_parcela>=1
 ), stats AS (
  SELECT i.card_id,count(*) geradas,
   greatest(0,least(coalesce(min(i.numero_parcela) FILTER(WHERE i.status<>'pago' AND i.data_pagamento IS NULL),max(i.numero_parcela)+1),coalesce(min(i.rn) FILTER(WHERE i.numero_parcela<>i.rn),max(i.numero_parcela)+1))-1)::integer ultima,
   count(*) FILTER(WHERE i.status NOT IN ('pago','previsto') AND i.data_pagamento IS NULL AND i.data_vencimento<(now() AT TIME ZONE 'America/Sao_Paulo')::date) vencidas,
   coalesce(sum(i.valor_parcela) FILTER(WHERE i.status NOT IN ('pago','previsto') AND i.data_pagamento IS NULL AND i.data_vencimento<(now() AT TIME ZONE 'America/Sao_Paulo')::date),0) valor_vencidas,
   count(*) FILTER(WHERE i.tipo='empresa' AND i.status<>'pago' AND i.data_pagamento IS NULL) mcf,
   min(i.numero_parcela) FILTER(WHERE i.data_vencimento>=date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')::date) atual,
   min(i.data_vencimento) FILTER(WHERE i.numero_parcela=2) segunda,
   min(i.data_vencimento) FILTER(WHERE i.numero_parcela=1) primeira
  FROM numbered i GROUP BY i.card_id
 ), resumo AS (
  SELECT c.*,coalesce(s.geradas,0) geradas,coalesce(s.ultima,0) ultima,coalesce(s.vencidas,0) vencidas,coalesce(s.valor_vencidas,0) valor_vencidas,coalesce(s.mcf,0) mcf,
   greatest(0,(least(greatest(coalesce(c.prazo_meses,1),1),greatest(1,coalesce(s.atual,
    (extract(year from age(date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo'),date_trunc('month',coalesce(s.segunda,s.primeira)::timestamp)))::integer*12+extract(month from age(date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo'),date_trunc('month',coalesce(s.segunda,s.primeira)::timestamp)))::integer+CASE WHEN s.segunda IS NULL THEN 1 ELSE 2 END),1)))-1)/12)*12+1 atual,
   n.numero_parcela,n.data_vencimento,n.valor_parcela,n.tipo
  FROM cards c LEFT JOIN stats s ON s.card_id=c.id LEFT JOIN LATERAL (
   SELECT i.numero_parcela,i.data_vencimento,i.valor_parcela,i.tipo FROM public.consortium_installments i WHERE i.card_id=c.id AND i.status<>'pago' AND i.data_pagamento IS NULL ORDER BY i.numero_parcela LIMIT 1
  ) n ON true
  WHERE (NOT coalesce(p_so_atraso,false) OR s.vencidas>0) AND (nullif(p_quem_paga,'') IS NULL OR n.tipo=p_quem_paga)
 )
 SELECT r.id,r.grupo,r.cota,r.cliente,r.status,r.vendedor_name,r.prazo_meses,r.geradas,r.ultima,r.vencidas,r.valor_vencidas,r.numero_parcela,r.data_vencimento,r.valor_parcela,r.tipo,r.mcf,r.atual,count(*) OVER()
 FROM resumo r ORDER BY r.cliente,r.grupo,r.cota,r.id LIMIT greatest(1,least(coalesce(p_limit,50),200)) OFFSET greatest(0,coalesce(p_offset,0));
$$;
REVOKE ALL ON FUNCTION public.consorcio_resumo_cotas(integer,integer,text,text,text,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consorcio_resumo_cotas(integer,integer,text,text,text,text,boolean,text) TO authenticated,service_role;