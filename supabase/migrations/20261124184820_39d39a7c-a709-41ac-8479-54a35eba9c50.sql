CREATE OR REPLACE FUNCTION public.gov_assinatura_decidir_servico(p_etapa uuid, p_uid uuid, p_decisao text, p_comentario text, p_metodo text, p_ip text, p_ua text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
 SELECT x.nome_completo, c.nome_exibicao cargo, coalesce(dp.nome,x.departamento) setor INTO emp FROM employees x LEFT JOIN cargos_catalogo c ON c.id=x.cargo_catalogo_id LEFT JOIN departamentos dp ON dp.id=gov_setor_do_colaborador(x.id) WHERE x.user_id=p_uid OR x.profile_id=p_uid ORDER BY (x.status='ativo') DESC LIMIT 1;
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
END $function$;