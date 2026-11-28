DROP FUNCTION public.consorcio_parcelas_cota(uuid,integer,integer);
CREATE FUNCTION public.consorcio_parcelas_cota(p_card_id uuid,p_de integer DEFAULT 1,p_ate integer DEFAULT 12)
RETURNS TABLE(id uuid,card_id uuid,numero_parcela integer,tipo text,valor_parcela numeric,valor_comissao numeric,data_vencimento date,data_pagamento date,status text,observacao text,pagamento_fonte text,pagamento_confirmado_por uuid,pagamento_confirmado_em timestamptz,conferido_embracon_em date,conferido_embracon_ref text,valor_estimado boolean,pagamento_confirmado_nome text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT i.id,i.card_id,i.numero_parcela,i.tipo,i.valor_parcela,i.valor_comissao,i.data_vencimento,i.data_pagamento,i.status,i.observacao,i.pagamento_fonte,i.pagamento_confirmado_por,i.pagamento_confirmado_em,i.conferido_embracon_em,i.conferido_embracon_ref,i.valor_estimado,p.full_name
 FROM public.consortium_installments i LEFT JOIN public.profiles p ON p.id=i.pagamento_confirmado_por
 WHERE i.card_id=p_card_id AND i.numero_parcela BETWEEN greatest(1,p_de) AND p_ate ORDER BY i.numero_parcela;
$$;
REVOKE ALL ON FUNCTION public.consorcio_parcelas_cota(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consorcio_parcelas_cota(uuid,integer,integer) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.consorcio_validar_confirmacao_parcela() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.pagamento_fonte IS NOT NULL AND NEW.pagamento_fonte NOT IN ('manual','mapa','newcon') THEN RAISE EXCEPTION 'Fonte de pagamento inválida'; END IF;
 IF NEW.status<>'pago' AND NEW.data_pagamento IS NULL AND (OLD.status='pago' OR OLD.data_pagamento IS NOT NULL) THEN
  NEW.pagamento_fonte:=NULL; NEW.pagamento_confirmado_por:=NULL; NEW.pagamento_confirmado_em:=NULL; NEW.conferido_embracon_em:=NULL; NEW.conferido_embracon_ref:=NULL;
 END IF;
 IF NEW.pagamento_fonte='manual' AND (OLD.pagamento_fonte IS DISTINCT FROM NEW.pagamento_fonte OR OLD.data_pagamento IS DISTINCT FROM NEW.data_pagamento OR OLD.status IS DISTINCT FROM NEW.status) THEN
  IF NEW.data_pagamento IS NULL OR NEW.data_pagamento > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Informe a data real do pagamento, não futura'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Confirmação manual exige usuário autenticado'; END IF;
  NEW.pagamento_confirmado_por:=auth.uid(); NEW.pagamento_confirmado_em:=now();
 END IF;
 RETURN NEW;
END $$;