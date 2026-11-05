CREATE OR REPLACE FUNCTION public.gov_meu_employee() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT e.id FROM employees e WHERE e.status='ativo' AND (e.user_id=auth.uid() OR e.profile_id=auth.uid() OR lower(e.email_pessoal)=lower(auth.jwt()->>'email')) ORDER BY (e.user_id=auth.uid()) DESC NULLS LAST, (e.profile_id=auth.uid()) DESC NULLS LAST,e.id LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.gov_meu_employee() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gov_meu_employee() TO authenticated,service_role;
ALTER TABLE public.gov_alcadas ADD COLUMN exige_justificativa boolean NOT NULL DEFAULT true;
CREATE TABLE public.gov_requisicoes_contratacao (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), solicitante_user_id uuid NOT NULL DEFAULT auth.uid(), solicitante_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
 departamento_id uuid REFERENCES public.departamentos(id), centro_custo text NOT NULL DEFAULT '', cargo_catalogo_id uuid REFERENCES public.cargos_catalogo(id), titulo text NOT NULL DEFAULT '', tipo text NOT NULL DEFAULT 'aumento_quadro', substituido_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL, quantidade integer NOT NULL DEFAULT 1,
 missao text NOT NULL DEFAULT '', responsabilidades text NOT NULL DEFAULT '', requisitos_obrigatorios text NOT NULL DEFAULT '', requisitos_desejaveis text NOT NULL DEFAULT '', competencias text NOT NULL DEFAULT '', indicadores text NOT NULL DEFAULT '', regime text NOT NULL DEFAULT 'CLT', salario_base numeric NOT NULL DEFAULT 0, variavel text NOT NULL DEFAULT '', beneficios text NOT NULL DEFAULT '', modelo_trabalho text NOT NULL DEFAULT 'presencial', local text NOT NULL DEFAULT '', data_inicio date, justificativa text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'rascunho', contratado_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
 atores_previstos jsonb NOT NULL DEFAULT '[]', enviado_em timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON public.gov_requisicoes_contratacao TO authenticated;
GRANT ALL ON public.gov_requisicoes_contratacao TO service_role;
ALTER TABLE public.gov_requisicoes_contratacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY gov_req_read ON public.gov_requisicoes_contratacao FOR SELECT TO authenticated USING (public.gov_is_rh_admin(auth.uid()) OR solicitante_user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.gov_cadeia_hierarquica(solicitante_employee_id) h WHERE h.employee_id=public.gov_meu_employee()) OR EXISTS(SELECT 1 FROM jsonb_array_elements(atores_previstos) a WHERE a->>'employee_id'=public.gov_meu_employee()::text OR a->>'role' IN (SELECT role::text FROM public.user_roles WHERE user_id=auth.uid())));
CREATE POLICY gov_req_insert ON public.gov_requisicoes_contratacao FOR INSERT TO authenticated WITH CHECK (solicitante_user_id=auth.uid() AND (public.gov_is_rh_admin(auth.uid()) OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'coordenador')));
CREATE POLICY gov_req_update ON public.gov_requisicoes_contratacao FOR UPDATE TO authenticated USING (public.gov_is_rh_admin(auth.uid()) OR solicitante_user_id=auth.uid()) WITH CHECK (public.gov_is_rh_admin(auth.uid()) OR solicitante_user_id=auth.uid());
CREATE INDEX ON public.gov_requisicoes_contratacao(solicitante_user_id,created_at DESC);
CREATE INDEX ON public.gov_requisicoes_contratacao(status,departamento_id);
CREATE OR REPLACE FUNCTION public.gov_requisicao_validar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; a record; precisa boolean; atores jsonb := '[]'; eid uuid;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'rascunho' THEN RAISE EXCEPTION 'Uma nova requisição deve começar como rascunho'; END IF;
  NEW.solicitante_user_id:=auth.uid(); NEW.solicitante_employee_id:=gov_meu_employee(); NEW.atores_previstos:='[]'; NEW.enviado_em:=NULL; NEW.contratado_employee_id:=NULL;
 ELSE
  IF NEW.solicitante_user_id IS DISTINCT FROM OLD.solicitante_user_id OR NEW.solicitante_employee_id IS DISTINCT FROM OLD.solicitante_employee_id THEN RAISE EXCEPTION 'Não é permitido trocar o solicitante'; END IF;
  NEW.atores_previstos:=OLD.atores_previstos; NEW.enviado_em:=OLD.enviado_em;
  IF OLD.status NOT IN ('rascunho','devolvida') AND (to_jsonb(NEW)-ARRAY['status','contratado_employee_id','updated_at','atores_previstos','enviado_em']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','contratado_employee_id','updated_at','atores_previstos','enviado_em']) THEN RAISE EXCEPTION 'A requisição enviada não pode ser editada'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
   IF NOT ((OLD.status IN ('rascunho','devolvida') AND NEW.status IN ('em_aprovacao','cancelada')) OR (OLD.status='em_aprovacao' AND NEW.status='cancelada') OR (OLD.status='aprovada' AND NEW.status IN ('em_recrutamento','cancelada')) OR (OLD.status='em_recrutamento' AND NEW.status IN ('concluida','cancelada'))) THEN RAISE EXCEPTION 'Transição não permitida. Aprovações e assinaturas serão habilitadas na Fase 5'; END IF;
   IF OLD.status IN ('aprovada','em_recrutamento') AND NOT gov_is_rh_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente RH ou administrador pode conduzir o recrutamento'; END IF;
  END IF;
  IF NEW.contratado_employee_id IS DISTINCT FROM OLD.contratado_employee_id AND NEW.status<>'concluida' THEN RAISE EXCEPTION 'Vincule o contratado apenas ao concluir'; END IF;
 END IF;
 IF NEW.tipo NOT IN ('aumento_quadro','substituicao') OR NEW.regime NOT IN ('CLT','PJ','Estágio','Temporário') OR NEW.modelo_trabalho NOT IN ('presencial','hibrido','remoto') OR NEW.quantidade<1 OR NEW.salario_base<0 THEN RAISE EXCEPTION 'Tipo, regime, modelo ou valores inválidos'; END IF;
 IF NEW.status='em_aprovacao' AND (TG_OP='INSERT' OR OLD.status<>NEW.status) THEN
  IF NEW.departamento_id IS NULL OR NEW.cargo_catalogo_id IS NULL OR btrim(NEW.titulo)='' OR btrim(NEW.centro_custo)='' OR btrim(NEW.missao)='' OR btrim(NEW.responsabilidades)='' OR btrim(NEW.requisitos_obrigatorios)='' OR btrim(NEW.competencias)='' OR btrim(NEW.indicadores)='' OR NEW.data_inicio IS NULL OR btrim(NEW.local)='' THEN RAISE EXCEPTION 'Preencha setor, centro de custo, cargo, título, descrição, local e início desejado'; END IF;
  IF NEW.tipo='substituicao' AND NEW.substituido_employee_id IS NULL THEN RAISE EXCEPTION 'Selecione o colaborador substituído'; END IF;
  SELECT * INTO c FROM cargos_catalogo WHERE id=NEW.cargo_catalogo_id;
  precisa:=NEW.tipo='aumento_quadro' OR (c.faixa_salarial_min IS NOT NULL AND NEW.salario_base<c.faixa_salarial_min) OR (c.faixa_salarial_max IS NOT NULL AND NEW.salario_base>c.faixa_salarial_max);
  atores:=jsonb_build_array(jsonb_build_object('papel','Solicitante','user_id',NEW.solicitante_user_id,'employee_id',NEW.solicitante_employee_id));
  eid:=gov_superior_imediato(NEW.solicitante_employee_id);
  IF eid IS NOT NULL THEN atores:=atores||jsonb_build_array(jsonb_build_object('papel','Superior imediato','employee_id',eid)); END IF;
  eid:=gov_responsavel_setor(NEW.departamento_id);
  IF eid IS NOT NULL THEN atores:=atores||jsonb_build_array(jsonb_build_object('papel','Responsável do setor','employee_id',eid)); END IF;
  atores:=atores||jsonb_build_array(jsonb_build_object('papel','RH','role','rh'));
  FOR a IN SELECT * FROM gov_alcadas WHERE ativo AND aplica_em IN ('contratacao','ambos') AND (cond_aumento_quadro IS NULL OR cond_aumento_quadro=(NEW.tipo='aumento_quadro')) AND (cond_salario_acima IS NULL OR NEW.salario_base>cond_salario_acima) AND (cond_departamento_id IS NULL OR cond_departamento_id=NEW.departamento_id) ORDER BY ordem,id LOOP
   precisa:=precisa OR a.exige_justificativa;
   eid:=CASE a.aprovador_tipo WHEN 'cargo' THEN gov_ocupante_cargo(a.aprovador_cargo_id) WHEN 'setor' THEN gov_responsavel_setor(a.aprovador_departamento_id) WHEN 'colaborador' THEN a.aprovador_employee_id ELSE NULL END;
   IF a.aprovador_tipo<>'papel' AND eid IS NULL THEN RAISE EXCEPTION 'Alçada % sem aprovador definido. Configure a Governança',a.nome; END IF;
   atores:=atores||jsonb_build_array(jsonb_build_object('papel',a.rotulo_papel,'employee_id',eid,'role',a.aprovador_role,'cargo_id',a.aprovador_cargo_id,'departamento_id',a.aprovador_departamento_id,'alcada_id',a.id));
  END LOOP;
  IF precisa AND btrim(NEW.justificativa)='' THEN RAISE EXCEPTION 'Justificativa obrigatória para aumento de quadro, salário fora da faixa ou alçada aplicável'; END IF;
  NEW.atores_previstos:=atores; NEW.enviado_em:=now();
 END IF;
 IF NEW.status='concluida' AND NEW.contratado_employee_id IS NULL THEN RAISE EXCEPTION 'Selecione o colaborador contratado'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.gov_requisicao_validar() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER gov_req_validate BEFORE INSERT OR UPDATE ON public.gov_requisicoes_contratacao FOR EACH ROW EXECUTE FUNCTION public.gov_requisicao_validar();
CREATE OR REPLACE FUNCTION public.gov_requisicao_opcoes() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT (gov_is_rh_admin(auth.uid()) OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'coordenador')) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('pessoas',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'nome',e.nome_completo)) FROM employees e WHERE gov_is_rh_admin(auth.uid()) OR e.id=gov_meu_employee() OR EXISTS(SELECT 1 FROM gov_cadeia_hierarquica(e.id) h WHERE h.employee_id=gov_meu_employee())), '[]'::jsonb)); END $$;
REVOKE ALL ON FUNCTION public.gov_requisicao_opcoes() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gov_requisicao_opcoes() TO authenticated,service_role;