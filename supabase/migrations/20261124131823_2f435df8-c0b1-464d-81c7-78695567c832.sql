CREATE TABLE public.gov_assinatura_versoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 doc_tipo text NOT NULL, doc_id uuid NOT NULL, versao integer NOT NULL,
 snapshot jsonb NOT NULL, hash text NOT NULL, status text NOT NULL DEFAULT 'ativa',
 created_at timestamptz NOT NULL DEFAULT now(), encerrada_em timestamptz,
 UNIQUE(doc_tipo, doc_id, versao));
CREATE TABLE public.gov_assinatura_etapas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 versao_id uuid NOT NULL REFERENCES public.gov_assinatura_versoes(id) ON DELETE CASCADE,
 doc_tipo text NOT NULL, doc_id uuid NOT NULL, ordem integer NOT NULL,
 papel text NOT NULL, employee_id uuid, user_id uuid, role public.app_role,
 status text NOT NULL DEFAULT 'pendente', prazo timestamptz,
 decidido_por uuid, decidido_nome text, decidido_cargo text, decidido_setor text,
 comentario text, metodo text, ip text, user_agent text, hash text, decidido_em timestamptz,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON public.gov_assinatura_etapas(doc_tipo, doc_id);
CREATE INDEX ON public.gov_assinatura_etapas(status) WHERE status='pendente';
GRANT ALL ON public.gov_assinatura_versoes, public.gov_assinatura_etapas TO service_role;
ALTER TABLE public.gov_assinatura_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gov_assinatura_etapas ENABLE ROW LEVEL SECURITY;

-- Eligibility of a user for a step
CREATE FUNCTION gov_private.gov_assin_elegivel(e public.gov_assinatura_etapas, _uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _uid IS NOT NULL AND (e.user_id=_uid
  OR (e.employee_id IS NOT NULL AND EXISTS(SELECT 1 FROM employees x WHERE x.id=e.employee_id AND (x.user_id=_uid OR x.profile_id=_uid)))
  OR (e.role IS NOT NULL AND e.employee_id IS NULL AND e.user_id IS NULL AND has_role(_uid,e.role)))
$$;

CREATE FUNCTION gov_private.gov_assin_iniciar(p_tipo text, p_id uuid, p_snapshot jsonb, p_atores jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; n int; a jsonb; o int:=0; r public.app_role;
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
  CONTINUE WHEN a->>'employee_id' IS NULL AND a->>'user_id' IS NULL AND r IS NULL;
  o:=o+1;
  INSERT INTO gov_assinatura_etapas(versao_id,doc_tipo,doc_id,ordem,papel,employee_id,user_id,role,prazo)
  VALUES(v,p_tipo,p_id,o,coalesce(nullif(a->>'papel',''),'Aprovador'),nullif(a->>'employee_id','')::uuid,nullif(a->>'user_id','')::uuid,
   CASE WHEN a->>'employee_id' IS NULL AND a->>'user_id' IS NULL THEN r END, now()+make_interval(days=>2*o));
 END LOOP;
END $$;

CREATE FUNCTION public.gov_assin_tg_requisicao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='em_aprovacao' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'em_aprovacao') THEN
  PERFORM gov_private.gov_assin_iniciar('requisicao',NEW.id,to_jsonb(NEW)-'updated_at',NEW.atores_previstos);
 ELSIF TG_OP='UPDATE' AND OLD.status='em_aprovacao' AND NEW.status<>'em_aprovacao' AND coalesce(current_setting('gov.assinatura',true),'')<>'1' THEN
  UPDATE gov_assinatura_etapas SET status='invalidada' WHERE doc_tipo='requisicao' AND doc_id=NEW.id AND status='pendente';
  UPDATE gov_assinatura_versoes SET status='invalidada',encerrada_em=now() WHERE doc_tipo='requisicao' AND doc_id=NEW.id AND status='ativa';
 END IF; RETURN NULL; END $$;
CREATE TRIGGER gov_assin_requisicao AFTER INSERT OR UPDATE OF status ON public.gov_requisicoes_contratacao FOR EACH ROW EXECUTE FUNCTION public.gov_assin_tg_requisicao();

CREATE FUNCTION public.gov_assin_tg_desligamento() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='em_aprovacao' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'em_aprovacao') THEN
  PERFORM gov_private.gov_assin_iniciar('desligamento',NEW.id,to_jsonb(NEW)-'updated_at',NEW.signatarios);
 END IF; RETURN NULL; END $$;
CREATE TRIGGER gov_assin_desligamento AFTER INSERT OR UPDATE OF status ON public.gov_desligamentos FOR EACH ROW EXECUTE FUNCTION public.gov_assin_tg_desligamento();

-- Allow decision transitions only from the signing engine
DO $do$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.gov_requisicao_validar'::regproc);
 IF position('IF NOT ((OLD.status IN' in d)=0 THEN RAISE EXCEPTION 'gov_requisicao_validar inesperada'; END IF;
 d:=replace(d,'IF NOT ((OLD.status IN','IF NOT (coalesce(current_setting(''gov.assinatura'',true),'''')=''1'' AND OLD.status=''em_aprovacao'' AND NEW.status IN (''aprovada'',''reprovada'',''devolvida'')) AND NOT ((OLD.status IN');
 EXECUTE d;
END $do$;

CREATE FUNCTION public.gov_assinatura_decidir_servico(p_etapa uuid, p_uid uuid, p_decisao text, p_comentario text, p_metodo text, p_ip text, p_ua text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e gov_assinatura_etapas; v gov_assinatura_versoes; emp record; novo text; restantes int;
BEGIN
 IF p_decisao NOT IN ('aprovada','reprovada','devolvida') OR p_metodo NOT IN ('senha','google') THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
 IF p_decisao<>'aprovada' AND coalesce(btrim(p_comentario),'')='' THEN RAISE EXCEPTION 'Comentário obrigatório para reprovar ou devolver'; END IF;
 SELECT * INTO e FROM gov_assinatura_etapas WHERE id=p_etapa FOR UPDATE;
 IF NOT FOUND OR e.status<>'pendente' THEN RAISE EXCEPTION 'Etapa não está pendente'; END IF;
 SELECT * INTO v FROM gov_assinatura_versoes WHERE id=e.versao_id FOR UPDATE;
 IF v.status<>'ativa' THEN RAISE EXCEPTION 'Versão não está mais ativa'; END IF;
 IF EXISTS(SELECT 1 FROM gov_assinatura_etapas x WHERE x.versao_id=e.versao_id AND x.status='pendente' AND x.ordem<e.ordem) THEN RAISE EXCEPTION 'Aguarde as etapas anteriores'; END IF;
 IF NOT gov_private.gov_assin_elegivel(e,p_uid) THEN RAISE EXCEPTION 'Você não é o aprovador desta etapa' USING ERRCODE='42501'; END IF;
 IF e.doc_tipo='desligamento' AND EXISTS(SELECT 1 FROM gov_desligamentos d JOIN employees x ON x.id=d.employee_id WHERE d.id=e.doc_id AND (x.user_id=p_uid OR x.profile_id=p_uid)) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 SELECT x.nome_completo, c.nome cargo, coalesce(dp.nome,x.departamento) setor INTO emp FROM employees x LEFT JOIN cargos_catalogo c ON c.id=x.cargo_catalogo_id LEFT JOIN departamentos dp ON dp.id=gov_setor_do_colaborador(x.id) WHERE x.user_id=p_uid OR x.profile_id=p_uid ORDER BY (x.status='ativo') DESC LIMIT 1;
 UPDATE gov_assinatura_etapas SET status=p_decisao, decidido_por=p_uid,
  decidido_nome=coalesce(emp.nome_completo,(SELECT full_name FROM profiles WHERE id=p_uid)), decidido_cargo=emp.cargo, decidido_setor=emp.setor,
  comentario=nullif(btrim(p_comentario),''), metodo=p_metodo, ip=p_ip, user_agent=left(p_ua,500), decidido_em=now(),
  hash=encode(extensions.digest(v.hash||'|'||e.id||'|'||p_uid||'|'||p_decisao||'|'||now()::text,'sha256'),'hex')
 WHERE id=e.id;
 SELECT count(*) INTO restantes FROM gov_assinatura_etapas WHERE versao_id=v.id AND status='pendente';
 IF p_decisao='aprovada' AND restantes>0 THEN RETURN jsonb_build_object('status','em_aprovacao'); END IF;
 novo:=p_decisao;
 UPDATE gov_assinatura_etapas SET status='invalidada' WHERE versao_id=v.id AND status='pendente';
 UPDATE gov_assinatura_versoes SET status=CASE WHEN p_decisao='devolvida' THEN 'invalidada' ELSE 'concluida' END, encerrada_em=now() WHERE id=v.id;
 PERFORM set_config('gov.assinatura','1',true);
 IF e.doc_tipo='requisicao' THEN
  UPDATE gov_requisicoes_contratacao SET status=novo WHERE id=e.doc_id;
 ELSE
  UPDATE gov_desligamentos SET status=CASE WHEN novo='devolvida' THEN 'rascunho' ELSE novo END, updated_at=now() WHERE id=e.doc_id;
 END IF;
 PERFORM set_config('gov.assinatura','',true);
 RETURN jsonb_build_object('status',novo);
END $$;
REVOKE ALL ON FUNCTION public.gov_assinatura_decidir_servico(uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gov_assinatura_decidir_servico(uuid,uuid,text,text,text,text,text) TO service_role;

CREATE FUNCTION gov_private.gov_minhas_aprovacoes() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('etapa_id',e.id,'doc_tipo',e.doc_tipo,'doc_id',e.doc_id,'papel',e.papel,'prazo',e.prazo,'ordem',e.ordem,'versao',v.versao,'hash',v.hash,
  'titulo',CASE WHEN e.doc_tipo='requisicao' THEN (SELECT r.titulo FROM gov_requisicoes_contratacao r WHERE r.id=e.doc_id) ELSE 'Desligamento: '||coalesce((SELECT x.nome_completo FROM gov_desligamentos d JOIN employees x ON x.id=d.employee_id WHERE d.id=e.doc_id),'') END,
  'enviado_em',v.created_at) ORDER BY e.prazo),'[]')
 FROM gov_assinatura_etapas e JOIN gov_assinatura_versoes v ON v.id=e.versao_id
 WHERE e.status='pendente' AND v.status='ativa' AND gov_private.gov_assin_elegivel(e,auth.uid())
  AND NOT EXISTS(SELECT 1 FROM gov_assinatura_etapas x WHERE x.versao_id=e.versao_id AND x.status='pendente' AND x.ordem<e.ordem)
  AND NOT (e.doc_tipo='desligamento' AND EXISTS(SELECT 1 FROM gov_desligamentos d WHERE d.id=e.doc_id AND gov_desligamento_proprio(d.employee_id)))
$$;
CREATE FUNCTION public.gov_minhas_aprovacoes() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_minhas_aprovacoes() $$;

CREATE FUNCTION gov_private.gov_assinatura_trilha(p_tipo text, p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE ok boolean;
BEGIN
 ok:=gov_is_rh_admin(auth.uid())
  OR (p_tipo='requisicao' AND EXISTS(SELECT 1 FROM gov_requisicoes_contratacao r WHERE r.id=p_id AND r.solicitante_user_id=auth.uid()))
  OR (p_tipo='desligamento' AND EXISTS(SELECT 1 FROM gov_desligamentos d WHERE d.id=p_id AND d.solicitante_user_id=auth.uid()))
  OR EXISTS(SELECT 1 FROM gov_assinatura_etapas e WHERE e.doc_tipo=p_tipo AND e.doc_id=p_id AND (e.decidido_por=auth.uid() OR gov_private.gov_assin_elegivel(e,auth.uid())));
 IF p_tipo='desligamento' AND EXISTS(SELECT 1 FROM gov_desligamentos d WHERE d.id=p_id AND gov_desligamento_proprio(d.employee_id)) THEN ok:=false; END IF;
 IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('versao',v.versao,'hash',v.hash,'status',v.status,'criada_em',v.created_at,'encerrada_em',v.encerrada_em,'snapshot',v.snapshot,
  'etapas',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'ordem',e.ordem,'papel',e.papel,'status',e.status,'prazo',e.prazo,
     'aprovador',coalesce((SELECT nome_completo FROM employees WHERE id=e.employee_id),(SELECT full_name FROM profiles WHERE id=e.user_id),CASE WHEN e.role IS NOT NULL THEN 'Qualquer '||upper(e.role::text) END),
     'decidido_nome',e.decidido_nome,'decidido_cargo',e.decidido_cargo,'decidido_setor',e.decidido_setor,'comentario',e.comentario,'metodo',e.metodo,'ip',e.ip,'user_agent',e.user_agent,'hash',e.hash,'decidido_em',e.decidido_em,
     'minha_vez',(e.status='pendente' AND v.status='ativa' AND gov_private.gov_assin_elegivel(e,auth.uid()) AND NOT EXISTS(SELECT 1 FROM gov_assinatura_etapas x WHERE x.versao_id=e.versao_id AND x.status='pendente' AND x.ordem<e.ordem)))
   ORDER BY e.ordem),'[]') FROM gov_assinatura_etapas e WHERE e.versao_id=v.id)) ORDER BY v.versao DESC)
  FROM gov_assinatura_versoes v WHERE v.doc_tipo=p_tipo AND v.doc_id=p_id),'[]');
END $$;
CREATE FUNCTION public.gov_assinatura_trilha(p_tipo text, p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_assinatura_trilha(p_tipo,p_id) $$;

REVOKE ALL ON FUNCTION gov_private.gov_assin_elegivel(public.gov_assinatura_etapas,uuid), gov_private.gov_assin_iniciar(text,uuid,jsonb,jsonb), gov_private.gov_minhas_aprovacoes(), public.gov_minhas_aprovacoes(), gov_private.gov_assinatura_trilha(text,uuid), public.gov_assinatura_trilha(text,uuid), public.gov_assin_tg_requisicao(), public.gov_assin_tg_desligamento() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION gov_private.gov_assin_elegivel(public.gov_assinatura_etapas,uuid), gov_private.gov_minhas_aprovacoes(), public.gov_minhas_aprovacoes(), gov_private.gov_assinatura_trilha(text,uuid), public.gov_assinatura_trilha(text,uuid) TO authenticated, service_role;

-- Backfill: requests already awaiting approval get their signing flow
SELECT gov_private.gov_assin_iniciar('requisicao',r.id,to_jsonb(r)-'updated_at',r.atores_previstos) FROM gov_requisicoes_contratacao r WHERE r.status='em_aprovacao';
SELECT gov_private.gov_assin_iniciar('desligamento',d.id,to_jsonb(d)-'updated_at',d.signatarios) FROM gov_desligamentos d WHERE d.status='em_aprovacao';