CREATE TABLE public.gov_desligamentos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL REFERENCES public.employees(id), solicitante_user_id uuid NOT NULL DEFAULT auth.uid(), solicitante_employee_id uuid REFERENCES public.employees(id), departamento_id uuid REFERENCES public.departamentos(id), tipo text NOT NULL DEFAULT 'sem_justa_causa', motivo text NOT NULL DEFAULT '', descricao text NOT NULL DEFAULT '', data_prevista date, justificativa text NOT NULL DEFAULT '', justificativa_reforcada text NOT NULL DEFAULT '', evidencias uuid[] NOT NULL DEFAULT '{}', extras uuid[] NOT NULL DEFAULT '{}', signatarios jsonb NOT NULL DEFAULT '[]', remocoes jsonb NOT NULL DEFAULT '[]', sem_evidencia_recente boolean NOT NULL DEFAULT true, status text NOT NULL DEFAULT 'rascunho', enviado_em timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gov_desligamentos TO authenticated;
GRANT ALL ON public.gov_desligamentos TO service_role;
ALTER TABLE public.gov_desligamentos ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION gov_private.gov_desligamento_proprio(p_employee uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM employees e WHERE e.id=p_employee AND (e.user_id=auth.uid() OR e.profile_id=auth.uid() OR lower(e.email_pessoal)=lower(auth.jwt()->>'email'))) $$;
CREATE FUNCTION public.gov_desligamento_proprio(p_employee uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_desligamento_proprio(p_employee) $$;
REVOKE ALL ON FUNCTION gov_private.gov_desligamento_proprio(uuid),public.gov_desligamento_proprio(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gov_private.gov_desligamento_proprio(uuid),public.gov_desligamento_proprio(uuid) TO authenticated,service_role;
CREATE POLICY gov_desligamento_ler ON public.gov_desligamentos FOR SELECT TO authenticated USING (NOT public.gov_desligamento_proprio(employee_id) AND (public.gov_is_rh_admin(auth.uid()) OR solicitante_user_id=auth.uid() OR public.gov_dossie_gestor(employee_id) OR EXISTS(SELECT 1 FROM jsonb_array_elements(signatarios) a WHERE a->>'user_id'=auth.uid()::text OR a->>'employee_id'=public.gov_meu_employee()::text OR a->>'role' IN (SELECT role::text FROM public.user_roles WHERE user_id=auth.uid()))));
CREATE INDEX ON public.gov_desligamentos(employee_id,created_at DESC);
CREATE INDEX ON public.gov_desligamentos(status,departamento_id);
CREATE FUNCTION gov_private.gov_desligamento_sugestoes(p_employee uuid,p_tipo text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e employees; r record; a jsonb; al record; atores jsonb:='[]'; eid uuid; original uuid; cargo uuid; setor uuid; atual_cargo uuid; substituto boolean;
BEGIN
 SELECT * INTO e FROM employees WHERE id=p_employee;
 IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não encontrado'; END IF;
 atores:=jsonb_build_array(jsonb_build_object('chave','solicitante','papel','Solicitante','user_id',auth.uid(),'employee_id',gov_meu_employee()));
 eid:=gov_superior_imediato(p_employee);
 IF eid IS NOT NULL AND eid<>p_employee THEN atores:=atores||jsonb_build_array(jsonb_build_object('chave','gestor','papel','Gestor atual','employee_id',eid)); END IF;
 eid:=gov_superior_imediato(coalesce(gov_superior_imediato(p_employee),gov_meu_employee()));
 IF eid IS NOT NULL AND eid<>p_employee THEN atores:=atores||jsonb_build_array(jsonb_build_object('chave','superior','papel','Superior imediato','employee_id',eid)); END IF;
 SELECT * INTO r FROM gov_requisicoes_contratacao WHERE contratado_employee_id=p_employee ORDER BY created_at DESC,id LIMIT 1;
 IF FOUND THEN
 FOR a IN SELECT value FROM jsonb_array_elements(r.atores_previstos) LOOP
 original:=nullif(a->>'employee_id','')::uuid; eid:=original; cargo:=nullif(a->>'cargo_id','')::uuid; setor:=nullif(a->>'departamento_id','')::uuid; substituto:=false;
 IF original IS NOT NULL THEN
 IF cargo IS NULL THEN SELECT h.cargo_catalogo_id INTO cargo FROM employee_cargo_historico h WHERE h.employee_id=original AND h.data_inicio<=coalesce(r.enviado_em,r.created_at)::date AND (h.data_fim IS NULL OR h.data_fim>=coalesce(r.enviado_em,r.created_at)::date) ORDER BY h.data_inicio DESC,h.id LIMIT 1; END IF;
 SELECT coalesce((SELECT h.cargo_catalogo_id FROM employee_cargo_historico h WHERE h.employee_id=original AND h.data_fim IS NULL ORDER BY h.data_inicio DESC,h.id LIMIT 1),x.cargo_catalogo_id) INTO atual_cargo FROM employees x WHERE x.id=original AND x.status='ativo';
 IF NOT FOUND OR (cargo IS NOT NULL AND atual_cargo IS DISTINCT FROM cargo) THEN eid:=coalesce(gov_ocupante_cargo(cargo),gov_responsavel_setor(setor)); substituto:=true; END IF;
 END IF;
 IF eid IS DISTINCT FROM p_employee AND (eid IS NOT NULL OR a->>'role' IS NOT NULL) THEN atores:=atores||jsonb_build_array(jsonb_build_object('chave','admissao:'||r.id||':'||coalesce(original::text,a->>'role',a->>'papel'),'papel','Contratação · '||coalesce(a->>'papel','Ator'),'employee_id',eid,'role',a->>'role','cargo_id',cargo,'departamento_id',setor,'substituto',substituto,'original_employee_id',original)); END IF;
 END LOOP;
 END IF;
 atores:=atores||jsonb_build_array(jsonb_build_object('chave','rh','papel','RH','role','rh','obrigatorio',true));
 FOR al IN SELECT * FROM gov_alcadas WHERE ativo AND aplica_em IN ('desligamento','ambos') AND (cond_tipos_desligamento IS NULL OR p_tipo=ANY(cond_tipos_desligamento)) AND (cond_departamento_id IS NULL OR cond_departamento_id=gov_setor_do_colaborador(p_employee)) AND (cond_salario_acima IS NULL OR e.salario_base>cond_salario_acima) AND cond_aumento_quadro IS NULL ORDER BY ordem,id LOOP
 eid:=CASE al.aprovador_tipo WHEN 'cargo' THEN gov_ocupante_cargo(al.aprovador_cargo_id) WHEN 'setor' THEN gov_responsavel_setor(al.aprovador_departamento_id) WHEN 'colaborador' THEN al.aprovador_employee_id ELSE NULL END;
 IF eid=p_employee OR (al.aprovador_tipo<>'papel' AND eid IS NULL) THEN RAISE EXCEPTION 'Alçada % sem aprovador elegível. Configure a Governança',al.nome; END IF;
 atores:=atores||jsonb_build_array(jsonb_build_object('chave','alcada:'||al.id,'papel',al.rotulo_papel,'employee_id',eid,'role',al.aprovador_role,'cargo_id',al.aprovador_cargo_id,'departamento_id',al.aprovador_departamento_id));
 END LOOP;
 RETURN (SELECT coalesce(jsonb_agg(a.value||jsonb_build_object('nome',coalesce(x.nome_completo,a.value->>'role','Solicitante'))),'[]') FROM jsonb_array_elements(atores) a LEFT JOIN employees x ON x.id=nullif(a.value->>'employee_id','')::uuid);
END $$;
REVOKE ALL ON FUNCTION gov_private.gov_desligamento_sugestoes(uuid,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION gov_private.gov_desligamento_contexto(p_employee uuid DEFAULT NULL,p_tipo text DEFAULT 'sem_justa_causa') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (gov_is_rh_admin(auth.uid()) OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'coordenador')) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 IF p_employee IS NOT NULL AND (gov_desligamento_proprio(p_employee) OR NOT gov_dossie_gestor(p_employee)) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('pessoas',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'nome',e.nome_completo,'departamento_id',gov_setor_do_colaborador(e.id))) FROM employees e WHERE NOT gov_desligamento_proprio(e.id) AND gov_dossie_gestor(e.id)),'[]'),'candidatos',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'nome',e.nome_completo)) FROM employees e WHERE e.status='ativo' AND e.id IS DISTINCT FROM p_employee),'[]'),'signatarios',CASE WHEN p_employee IS NULL THEN '[]'::jsonb ELSE gov_private.gov_desligamento_sugestoes(p_employee,p_tipo) END,'registros',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.ocorrido_em DESC,r.id) FROM gov_dossie_registros r WHERE r.employee_id=p_employee),'[]'),'sem_evidencia_recente',NOT EXISTS(SELECT 1 FROM gov_dossie_registros r WHERE r.employee_id=p_employee AND r.tipo IN ('yellow_flag','red_flag') AND r.ocorrido_em>=now()-interval '6 months' AND r.ocorrido_em<=now()));
END $$;
CREATE FUNCTION public.gov_desligamento_contexto(p_employee uuid DEFAULT NULL,p_tipo text DEFAULT 'sem_justa_causa') RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_desligamento_contexto(p_employee,p_tipo) $$;
REVOKE ALL ON FUNCTION gov_private.gov_desligamento_contexto(uuid,text),public.gov_desligamento_contexto(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gov_private.gov_desligamento_contexto(uuid,text),public.gov_desligamento_contexto(uuid,text) TO authenticated,service_role;
CREATE FUNCTION gov_private.gov_desligamento_salvar(p_dados jsonb) RETURNS public.gov_desligamentos LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r gov_desligamentos; ant gov_desligamentos; sugestoes jsonb; a jsonb; rm jsonb; removidos jsonb:='[]'; eid uuid; rid uuid:=nullif(p_dados->>'id','')::uuid;
BEGIN
 eid:=nullif(p_dados->>'employee_id','')::uuid;
 IF eid IS NULL OR auth.uid() IS NULL OR gov_desligamento_proprio(eid) OR NOT gov_dossie_gestor(eid) OR NOT (gov_is_rh_admin(auth.uid()) OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'coordenador')) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 IF rid IS NOT NULL THEN SELECT * INTO ant FROM gov_desligamentos WHERE id=rid FOR UPDATE; IF NOT FOUND OR ant.employee_id<>eid OR (ant.solicitante_user_id<>auth.uid() AND NOT gov_is_rh_admin(auth.uid())) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF; IF ant.status<>'rascunho' THEN RAISE EXCEPTION 'Solicitação enviada não pode ser editada'; END IF; END IF;
 r.id:=coalesce(rid,gen_random_uuid());r.employee_id:=eid;r.solicitante_user_id:=coalesce(ant.solicitante_user_id,auth.uid());r.solicitante_employee_id:=coalesce(ant.solicitante_employee_id,gov_meu_employee());r.departamento_id:=gov_setor_do_colaborador(eid);
 r.tipo:=coalesce(p_dados->>'tipo','sem_justa_causa');r.motivo:=coalesce(p_dados->>'motivo','');r.descricao:=coalesce(p_dados->>'descricao','');r.data_prevista:=nullif(p_dados->>'data_prevista','')::date;r.justificativa:=coalesce(p_dados->>'justificativa','');r.justificativa_reforcada:=coalesce(p_dados->>'justificativa_reforcada','');r.status:=coalesce(p_dados->>'status','rascunho');
 IF r.tipo NOT IN ('sem_justa_causa','justa_causa','acordo','experiencia','pj','pedido_demissao') OR r.status NOT IN ('rascunho','em_aprovacao') THEN RAISE EXCEPTION 'Tipo ou status inválido. Decisões dependem da Fase 5'; END IF;
 r.evidencias:=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(p_dados->'evidencias','[]')));r.extras:=ARRAY(SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(coalesce(p_dados->'extras','[]')));
 IF EXISTS(SELECT 1 FROM unnest(r.evidencias) x WHERE NOT EXISTS(SELECT 1 FROM gov_dossie_registros d WHERE d.id=x AND d.employee_id=eid)) OR EXISTS(SELECT 1 FROM unnest(r.extras) x WHERE x=eid OR NOT EXISTS(SELECT 1 FROM employees e WHERE e.id=x AND e.status='ativo')) THEN RAISE EXCEPTION 'Evidência ou participante inválido'; END IF;
 sugestoes:=gov_private.gov_desligamento_sugestoes(eid,r.tipo);
 -- Preserve the original requester when RH edits a draft.
 sugestoes:=jsonb_set(sugestoes,'{0}',jsonb_build_object('chave','solicitante','papel','Solicitante','user_id',r.solicitante_user_id,'employee_id',r.solicitante_employee_id,'nome',coalesce((SELECT nome_completo FROM employees WHERE id=r.solicitante_employee_id),'Solicitante')));
 FOR rm IN SELECT value FROM jsonb_array_elements(coalesce(p_dados->'remocoes','[]')) LOOP
 IF coalesce(btrim(rm->>'justificativa'),'')='' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(sugestoes) a WHERE a->>'chave'=rm->>'chave' AND coalesce((a->>'obrigatorio')::boolean,false)=false) THEN RAISE EXCEPTION 'Remoção exige justificativa e participante sugerido; RH é obrigatório'; END IF;
 SELECT value INTO a FROM jsonb_array_elements(coalesce(ant.remocoes,'[]')) WHERE value->>'chave'=rm->>'chave' AND value->>'justificativa'=rm->>'justificativa';
 removidos:=removidos||jsonb_build_array(jsonb_build_object('chave',rm->>'chave','justificativa',rm->>'justificativa','validada_por',a->>'validada_por','validada_em',a->>'validada_em'));
 END LOOP;
 r.remocoes:=removidos;
 r.signatarios:=coalesce((SELECT jsonb_agg(a.value) FROM jsonb_array_elements(sugestoes) a WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(removidos) rm WHERE rm->>'chave'=a.value->>'chave' AND rm->>'validada_por' IS NOT NULL)),'[]');
 r.signatarios:=r.signatarios||coalesce((SELECT jsonb_agg(jsonb_build_object('chave','extra:'||e.id,'papel','Adicional','employee_id',e.id,'nome',e.nome_completo)) FROM employees e WHERE e.id=ANY(r.extras)),'[]');
 r.sem_evidencia_recente:=NOT EXISTS(SELECT 1 FROM gov_dossie_registros d WHERE d.employee_id=eid AND d.tipo IN ('yellow_flag','red_flag') AND d.ocorrido_em>=now()-interval '6 months' AND d.ocorrido_em<=now());
 IF r.status='em_aprovacao' THEN
 IF btrim(r.motivo)='' OR btrim(r.descricao)='' OR r.data_prevista IS NULL OR btrim(r.justificativa)='' THEN RAISE EXCEPTION 'Preencha motivo, descrição, data prevista e justificativa'; END IF;
 IF r.sem_evidencia_recente AND btrim(r.justificativa_reforcada)='' THEN RAISE EXCEPTION 'Inclua a justificativa reforçada para a ausência de evidências recentes'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(r.remocoes) a WHERE a->>'validada_por' IS NULL) THEN RAISE EXCEPTION 'Aguarde a validação do RH para as remoções solicitadas'; END IF;
 r.enviado_em:=now();END IF;
 r.created_at:=coalesce(ant.created_at,now());r.updated_at:=now();
 INSERT INTO gov_desligamentos SELECT r.* ON CONFLICT(id) DO UPDATE SET tipo=EXCLUDED.tipo,motivo=EXCLUDED.motivo,descricao=EXCLUDED.descricao,data_prevista=EXCLUDED.data_prevista,justificativa=EXCLUDED.justificativa,justificativa_reforcada=EXCLUDED.justificativa_reforcada,evidencias=EXCLUDED.evidencias,extras=EXCLUDED.extras,signatarios=EXCLUDED.signatarios,remocoes=EXCLUDED.remocoes,sem_evidencia_recente=EXCLUDED.sem_evidencia_recente,status=EXCLUDED.status,enviado_em=EXCLUDED.enviado_em,updated_at=EXCLUDED.updated_at RETURNING * INTO r;
 RETURN r;
END $$;
CREATE FUNCTION public.gov_desligamento_salvar(p_dados jsonb) RETURNS public.gov_desligamentos LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_desligamento_salvar(p_dados) $$;
REVOKE ALL ON FUNCTION gov_private.gov_desligamento_salvar(jsonb),public.gov_desligamento_salvar(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gov_private.gov_desligamento_salvar(jsonb),public.gov_desligamento_salvar(jsonb) TO authenticated,service_role;
CREATE FUNCTION gov_private.gov_desligamento_validar_remocao(p_id uuid,p_chave text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r gov_desligamentos; BEGIN
 SELECT * INTO r FROM gov_desligamentos WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT gov_is_rh_admin(auth.uid()) OR gov_desligamento_proprio(r.employee_id) THEN RAISE EXCEPTION 'Somente RH pode validar a remoção' USING ERRCODE='42501'; END IF;
 IF r.status<>'rascunho' OR p_chave='rh' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.remocoes) a WHERE a->>'chave'=p_chave AND btrim(a->>'justificativa')<>'') THEN RAISE EXCEPTION 'Remoção inválida'; END IF;
 UPDATE gov_desligamentos SET remocoes=(SELECT jsonb_agg(CASE WHEN a->>'chave'=p_chave THEN a||jsonb_build_object('validada_por',auth.uid(),'validada_em',now()) ELSE a END) FROM jsonb_array_elements(r.remocoes) a), signatarios=coalesce((SELECT jsonb_agg(a) FROM jsonb_array_elements(r.signatarios) a WHERE a->>'chave'<>p_chave),'[]'),updated_at=now() WHERE id=p_id;
END $$;
CREATE FUNCTION public.gov_desligamento_validar_remocao(p_id uuid,p_chave text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_desligamento_validar_remocao(p_id,p_chave) $$;
REVOKE ALL ON FUNCTION gov_private.gov_desligamento_validar_remocao(uuid,text),public.gov_desligamento_validar_remocao(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gov_private.gov_desligamento_validar_remocao(uuid,text),public.gov_desligamento_validar_remocao(uuid,text) TO authenticated,service_role;