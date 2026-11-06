ALTER TABLE public.gov_desligamentos ADD COLUMN feedbacks_construtivos uuid[] NOT NULL DEFAULT '{}';
DO $$ DECLARE def text; BEGIN
SELECT pg_get_functiondef('gov_private.gov_desligamento_salvar(jsonb)'::regprocedure) INTO def;
def:=replace(def,'r.id:=coalesce(rid,gen_random_uuid());','r.feedbacks_construtivos:=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(p_dados->''feedbacks_construtivos'',''[]''))); IF EXISTS(SELECT 1 FROM unnest(r.feedbacks_construtivos) x WHERE NOT EXISTS(SELECT 1 FROM gov_dossie_registros d WHERE d.id=x AND d.employee_id=eid AND d.tipo=''feedback'')) THEN RAISE EXCEPTION ''Feedback construtivo deve referenciar feedback do mesmo colaborador''; END IF; r.id:=coalesce(rid,gen_random_uuid());');
def:=replace(def,'d.tipo IN (''yellow_flag'',''red_flag'') AND d.ocorrido_em','(d.tipo IN (''yellow_flag'',''red_flag'') OR (d.tipo=''feedback'' AND d.id=ANY(r.feedbacks_construtivos))) AND d.ocorrido_em');
def:=replace(def,'tipo=EXCLUDED.tipo,motivo=EXCLUDED.motivo','feedbacks_construtivos=EXCLUDED.feedbacks_construtivos,tipo=EXCLUDED.tipo,motivo=EXCLUDED.motivo');
EXECUTE def;
END $$;
CREATE FUNCTION gov_private.gov_desligamento_detalhe(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r gov_desligamentos; atores jsonb; BEGIN
 SELECT * INTO r FROM gov_desligamentos WHERE id=p_id;
 IF NOT FOUND OR auth.uid() IS NULL OR gov_desligamento_proprio(r.employee_id) OR NOT (gov_is_rh_admin(auth.uid()) OR r.solicitante_user_id=auth.uid() OR gov_dossie_gestor(r.employee_id) OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.signatarios) a WHERE a->>'user_id'=auth.uid()::text OR a->>'employee_id'=gov_meu_employee()::text OR a->>'role' IN (SELECT role::text FROM user_roles WHERE user_id=auth.uid()))) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 atores:=r.signatarios;
 IF r.status='rascunho' AND (gov_is_rh_admin(auth.uid()) OR r.solicitante_user_id=auth.uid()) THEN
 atores:=gov_private.gov_desligamento_sugestoes(r.employee_id,r.tipo);
 atores:=jsonb_set(atores,'{0}',jsonb_build_object('chave','solicitante','papel','Solicitante','user_id',r.solicitante_user_id,'employee_id',r.solicitante_employee_id,'nome',coalesce((SELECT nome_completo FROM employees WHERE id=r.solicitante_employee_id),'Solicitante')));
 END IF;
 RETURN jsonb_build_object('nome',(SELECT nome_completo FROM employees WHERE id=r.employee_id),'registros',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.ocorrido_em DESC,d.id) FROM gov_dossie_registros d WHERE d.employee_id=r.employee_id AND (d.id=ANY(r.evidencias) OR (r.status='rascunho' AND gov_dossie_gestor(r.employee_id)))),'[]'),'signatarios',atores);
END $$;
CREATE FUNCTION public.gov_desligamento_detalhe(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_desligamento_detalhe(p_id) $$;
REVOKE ALL ON FUNCTION gov_private.gov_desligamento_detalhe(uuid),public.gov_desligamento_detalhe(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gov_private.gov_desligamento_detalhe(uuid),public.gov_desligamento_detalhe(uuid) TO authenticated,service_role;