ALTER TABLE public.consortium_installments ADD COLUMN IF NOT EXISTS pagamento_fonte text, ADD COLUMN IF NOT EXISTS pagamento_confirmado_por uuid, ADD COLUMN IF NOT EXISTS pagamento_confirmado_em timestamptz, ADD COLUMN IF NOT EXISTS conferido_embracon_em date, ADD COLUMN IF NOT EXISTS conferido_embracon_ref text, ADD COLUMN IF NOT EXISTS valor_estimado boolean;
-- Existing rows stay NULL; default applies only to subsequent inserts.
ALTER TABLE public.consortium_installments ALTER COLUMN valor_estimado SET DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_installments_card_numero ON public.consortium_installments(card_id,numero_parcela);
CREATE INDEX IF NOT EXISTS idx_installments_vencimento_status ON public.consortium_installments(data_vencimento,status);

CREATE OR REPLACE FUNCTION public.consorcio_validar_confirmacao_parcela() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.pagamento_fonte IS NOT NULL AND NEW.pagamento_fonte NOT IN ('manual','mapa','newcon') THEN RAISE EXCEPTION 'Fonte de pagamento inválida'; END IF;
 IF NEW.pagamento_fonte='manual' AND (OLD.pagamento_fonte IS DISTINCT FROM NEW.pagamento_fonte OR OLD.data_pagamento IS DISTINCT FROM NEW.data_pagamento OR OLD.status IS DISTINCT FROM NEW.status) THEN
  IF NEW.data_pagamento IS NULL OR NEW.data_pagamento > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Informe a data real do pagamento, não futura'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Confirmação manual exige usuário autenticado'; END IF;
  NEW.pagamento_confirmado_por := auth.uid(); NEW.pagamento_confirmado_em := now();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consorcio_validar_confirmacao_parcela BEFORE UPDATE ON public.consortium_installments FOR EACH ROW EXECUTE FUNCTION public.consorcio_validar_confirmacao_parcela();

CREATE OR REPLACE FUNCTION public.consorcio_situacao_cotas(p_card_ids uuid[]) RETURNS TABLE(card_id uuid,total_parcelas bigint,parcelas_pagas bigint,tem_atraso boolean) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT i.card_id,count(*),count(*) FILTER (WHERE i.status='pago' OR i.data_pagamento IS NOT NULL),bool_or(i.status NOT IN ('pago','previsto') AND i.data_pagamento IS NULL AND i.data_vencimento<(now() AT TIME ZONE 'America/Sao_Paulo')::date)
 FROM public.consortium_installments i WHERE i.card_id=ANY(p_card_ids) GROUP BY i.card_id;
$$;
REVOKE ALL ON FUNCTION public.consorcio_situacao_cotas(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consorcio_situacao_cotas(uuid[]) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.consorcio_resumo_cotas(p_limit integer DEFAULT 50,p_offset integer DEFAULT 0,p_busca text DEFAULT NULL,p_grupo text DEFAULT NULL,p_status text DEFAULT NULL,p_quem_paga text DEFAULT NULL,p_so_atraso boolean DEFAULT false,p_responsavel text DEFAULT NULL)
RETURNS TABLE(card_id uuid,grupo text,cota text,cliente text,status_cota text,responsavel text,prazo integer,parcelas_geradas bigint,ultima_paga integer,vencidas_qtd bigint,vencidas_valor numeric,proxima_numero integer,proxima_vencimento date,proxima_valor numeric,proxima_quem_paga text,mcf_aberto bigint,bloco_atual integer,total bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH cards AS MATERIALIZED (
  SELECT c.id,c.grupo,c.cota,CASE WHEN c.tipo_pessoa='pj' THEN coalesce(c.razao_social,c.nome_completo,'Sem nome') ELSE coalesce(c.nome_completo,'Sem nome') END cliente,c.status,c.vendedor_name,c.prazo_meses
  FROM public.consortium_cards c
  WHERE (nullif(p_busca,'') IS NULL OR concat_ws(' ',c.nome_completo,c.razao_social,c.grupo,c.cota) ILIKE '%'||p_busca||'%')
   AND (nullif(p_grupo,'') IS NULL OR c.grupo=p_grupo) AND (nullif(p_status,'') IS NULL OR c.status=p_status) AND (nullif(p_responsavel,'') IS NULL OR c.vendedor_name ILIKE '%'||p_responsavel||'%')
 ), numbered AS (
  SELECT i.*,row_number() OVER(PARTITION BY i.card_id ORDER BY i.numero_parcela) rn FROM public.consortium_installments i JOIN cards c ON c.id=i.card_id WHERE i.numero_parcela>=1
 ), stats AS (
  SELECT i.card_id,count(*) geradas,
   greatest(0,least(coalesce(min(i.numero_parcela) FILTER(WHERE i.status<>'pago' AND i.data_pagamento IS NULL),max(i.numero_parcela)+1),coalesce(min(i.rn) FILTER(WHERE i.numero_parcela<>i.rn),max(i.numero_parcela)+1))-1)::integer ultima,
   count(*) FILTER(WHERE i.status NOT IN ('pago','previsto') AND i.data_pagamento IS NULL AND i.data_vencimento<(now() AT TIME ZONE 'America/Sao_Paulo')::date) vencidas,
   coalesce(sum(i.valor_parcela) FILTER(WHERE i.status NOT IN ('pago','previsto') AND i.data_pagamento IS NULL AND i.data_vencimento<(now() AT TIME ZONE 'America/Sao_Paulo')::date),0) valor_vencidas,
   count(*) FILTER(WHERE i.tipo='empresa' AND i.status<>'pago' AND i.data_pagamento IS NULL) mcf,
   min(i.numero_parcela) FILTER(WHERE i.data_vencimento>=date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')::date) atual
  FROM numbered i GROUP BY i.card_id
 ), resumo AS (
  SELECT c.*,coalesce(s.geradas,0) geradas,coalesce(s.ultima,0) ultima,coalesce(s.vencidas,0) vencidas,coalesce(s.valor_vencidas,0) valor_vencidas,coalesce(s.mcf,0) mcf,
   greatest(0,(coalesce(s.atual,s.ultima+1,1)-1)/12)*12+1 atual,n.numero_parcela,n.data_vencimento,n.valor_parcela,n.tipo
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

CREATE OR REPLACE FUNCTION public.consorcio_parcelas_cota(p_card_id uuid,p_de integer DEFAULT 1,p_ate integer DEFAULT 12) RETURNS SETOF public.consortium_installments LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT i.* FROM public.consortium_installments i WHERE i.card_id=p_card_id AND i.numero_parcela BETWEEN greatest(1,p_de) AND p_ate ORDER BY i.numero_parcela;
$$;
REVOKE ALL ON FUNCTION public.consorcio_parcelas_cota(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consorcio_parcelas_cota(uuid,integer,integer) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.consorcio_gerar_parcelas(p_card_id uuid,p_parcelas jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_qtd integer:=0;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' AND NOT coalesce(public.can_access_consorcio_pii(auth.uid()),false) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF p_card_id IS NULL OR p_parcelas IS NULL OR jsonb_typeof(p_parcelas)<>'array' THEN RAISE EXCEPTION 'card_id e array de parcelas são obrigatórios'; END IF;
 PERFORM set_config('app.bulk_parcelas','on',true);
 INSERT INTO public.consortium_installments(card_id,numero_parcela,tipo,valor_parcela,valor_comissao,data_vencimento,status,valor_estimado)
 SELECT p_card_id,(e->>'numero_parcela')::integer,e->>'tipo',(e->>'valor_parcela')::numeric,(e->>'valor_comissao')::numeric,(e->>'data_vencimento')::date,e->>'status',coalesce((e->>'valor_estimado')::boolean,false) FROM jsonb_array_elements(p_parcelas) e;
 SELECT count(*) INTO v_qtd FROM jsonb_array_elements(p_parcelas);
 PERFORM public.log_card_event(p_card_id,'parcela'::public.card_activity_category,'installment_created'::public.card_activity_event,'Cronograma de '||v_qtd||' parcelas gerado',NULL,jsonb_build_object('quantidade',v_qtd),'{}'::jsonb,NULL,NULL,NULL,NULL);
 PERFORM set_config('app.bulk_parcelas','off',true);
 RETURN v_qtd;
END $$;
REVOKE ALL ON FUNCTION public.consorcio_gerar_parcelas(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consorcio_gerar_parcelas(uuid,jsonb) TO authenticated,service_role;