CREATE OR REPLACE FUNCTION gov_private.gov_assin_iniciar(p_tipo text, p_id uuid, p_snapshot jsonb, p_atores jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; n int; a jsonb; o int:=0; r public.app_role; emp uuid; usr uuid; ex uuid; pp text;
BEGIN
 UPDATE gov_assinatura_etapas SET status='invalidada' WHERE doc_tipo=p_tipo AND doc_id=p_id AND status='pendente';
 UPDATE gov_assinatura_versoes SET status='invalidada', encerrada_em=now() WHERE doc_tipo=p_tipo AND doc_id=p_id AND status='ativa';
 SELECT coalesce(max(versao),0)+1 INTO n FROM gov_assinatura_versoes WHERE doc_tipo=p_tipo AND doc_id=p_id;
 INSERT INTO gov_assinatura_versoes(doc_tipo,doc_id,versao,snapshot,hash)
 VALUES(p_tipo,p_id,n,p_snapshot,encode(extensions.digest(p_snapshot::text,'sha256'),'hex')) RETURNING id INTO v;
 FOR a IN SELECT value FROM jsonb_array_elements(coalesce(p_atores,'[]')) LOOP
  CONTINUE WHEN coalesce(a->>'papel','')='Solicitante' OR a->>'chave'='solicitante';
  r:=CASE WHEN a->>'role' IN (SELECT unnest(enum_range(NULL::app_role))::text) THEN (a->>'role')::app_role
          WHEN a->>'chave'='rh' THEN 'rh'::app_role ELSE NULL END;
  emp:=nullif(a->>'employee_id','')::uuid; usr:=nullif(a->>'user_id','')::uuid;
  CONTINUE WHEN emp IS NULL AND usr IS NULL AND r IS NULL;
  pp:=coalesce(nullif(a->>'papel',''),'Aprovador');
  SELECT id INTO ex FROM gov_assinatura_etapas WHERE versao_id=v AND ((emp IS NOT NULL AND employee_id=emp) OR (emp IS NULL AND usr IS NOT NULL AND user_id=usr) OR (emp IS NULL AND usr IS NULL AND employee_id IS NULL AND user_id IS NULL AND role=r)) LIMIT 1;
  IF ex IS NOT NULL THEN
   UPDATE gov_assinatura_etapas SET papel=CASE WHEN position(pp in papel)>0 THEN papel ELSE papel||' · '||pp END WHERE id=ex;
   CONTINUE;
  END IF;
  o:=o+1;
  INSERT INTO gov_assinatura_etapas(versao_id,doc_tipo,doc_id,ordem,papel,employee_id,user_id,role,prazo)
  VALUES(v,p_tipo,p_id,o,pp,emp,usr,CASE WHEN emp IS NULL AND usr IS NULL THEN r END, now()+make_interval(days=>2*o));
 END LOOP;
END $$;
-- Rebuild flows that have no decision yet
DELETE FROM gov_assinatura_versoes v WHERE v.status='ativa' AND NOT EXISTS(SELECT 1 FROM gov_assinatura_etapas e WHERE e.versao_id=v.id AND e.decidido_em IS NOT NULL);
SELECT gov_private.gov_assin_iniciar('requisicao',r.id,to_jsonb(r)-'updated_at',r.atores_previstos) FROM gov_requisicoes_contratacao r WHERE r.status='em_aprovacao';
SELECT gov_private.gov_assin_iniciar('desligamento',d.id,to_jsonb(d)-'updated_at',d.signatarios) FROM gov_desligamentos d WHERE d.status='em_aprovacao';