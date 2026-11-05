ALTER TABLE public.employee_cargo_historico ADD COLUMN IF NOT EXISTS interino boolean NOT NULL DEFAULT false;

-- Bloqueio de ciclos
CREATE OR REPLACE FUNCTION public.gov_estrutura_sem_ciclo() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v uuid; n int := 0;
BEGIN
  IF TG_TABLE_NAME = 'departamentos' THEN
    IF NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id THEN RETURN NEW; END IF;
    v := NEW.parent_id;
    WHILE v IS NOT NULL AND n < 50 LOOP
      IF v = NEW.id THEN RAISE EXCEPTION 'Um setor não pode ficar abaixo de um subsetor seu'; END IF;
      SELECT parent_id INTO v FROM departamentos WHERE id = v; n := n + 1;
    END LOOP;
  ELSE
    IF NEW.reporta_a_cargo_id IS NOT DISTINCT FROM OLD.reporta_a_cargo_id
       AND NEW.departamento_id IS NOT DISTINCT FROM OLD.departamento_id THEN RETURN NEW; END IF;
    IF NEW.departamento_id IS NULL THEN RAISE EXCEPTION 'O cargo precisa ter um setor'; END IF;
    v := NEW.reporta_a_cargo_id;
    WHILE v IS NOT NULL AND n < 50 LOOP
      IF v = NEW.id THEN RAISE EXCEPTION 'Um cargo não pode reportar a um subordinado seu'; END IF;
      SELECT reporta_a_cargo_id INTO v FROM cargos_catalogo WHERE id = v; n := n + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS gov_dep_sem_ciclo ON public.departamentos;
CREATE TRIGGER gov_dep_sem_ciclo BEFORE UPDATE OF parent_id ON public.departamentos FOR EACH ROW EXECUTE FUNCTION public.gov_estrutura_sem_ciclo();
DROP TRIGGER IF EXISTS gov_cargo_sem_ciclo ON public.cargos_catalogo;
CREATE TRIGGER gov_cargo_sem_ciclo BEFORE UPDATE OF reporta_a_cargo_id, departamento_id ON public.cargos_catalogo FOR EACH ROW EXECUTE FUNCTION public.gov_estrutura_sem_ciclo();

-- Auditoria
CREATE OR REPLACE FUNCTION public.gov_estrutura_auditar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO audit_logs(action, table_name, record_id, old_data, new_data, user_id)
  VALUES (TG_OP, TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
    auth.uid());
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.gov_estrutura_auditar() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS gov_audit_dep ON public.departamentos;
CREATE TRIGGER gov_audit_dep AFTER INSERT OR UPDATE OR DELETE ON public.departamentos FOR EACH ROW EXECUTE FUNCTION public.gov_estrutura_auditar();
DROP TRIGGER IF EXISTS gov_audit_cargo ON public.cargos_catalogo;
CREATE TRIGGER gov_audit_cargo AFTER INSERT OR UPDATE OR DELETE ON public.cargos_catalogo FOR EACH ROW EXECUTE FUNCTION public.gov_estrutura_auditar();
DROP TRIGGER IF EXISTS gov_audit_ech ON public.employee_cargo_historico;
CREATE TRIGGER gov_audit_ech AFTER INSERT OR UPDATE OR DELETE ON public.employee_cargo_historico FOR EACH ROW EXECUTE FUNCTION public.gov_estrutura_auditar();

-- Leitura da estrutura numa data
CREATE OR REPLACE FUNCTION public.gov_estrutura_em(p_data date DEFAULT current_date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rh boolean; v_me uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
  v_rh := gov_is_rh_admin(auth.uid());
  SELECT id INTO v_me FROM employees WHERE user_id = auth.uid() LIMIT 1;
  RETURN jsonb_build_object(
    'pode_editar', v_rh,
    'meu_employee_id', v_me,
    'setores', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'nome',d.nome,'parent_id',d.parent_id,
        'responsavel_employee_id',d.responsavel_employee_id,'ordem',d.ordem) ORDER BY d.ordem NULLS LAST, d.nome)
      FROM departamentos d WHERE COALESCE(d.ativo,true)), '[]'),
    'cargos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'nome',c.nome_exibicao,'descricao',c.descricao,
        'nivel',c.nivel,'departamento_id',c.departamento_id,'reporta_a_cargo_id',c.reporta_a_cargo_id,
        'faixa_min',CASE WHEN v_rh THEN c.faixa_salarial_min END,'faixa_max',CASE WHEN v_rh THEN c.faixa_salarial_max END)
        ORDER BY c.nivel NULLS LAST, c.nome_exibicao)
      FROM cargos_catalogo c WHERE c.ativo), '[]'),
    'pessoas', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'nome',e.nome_completo,'gestor_id',e.gestor_id,
        'cargo_catalogo_id',e.cargo_catalogo_id,'avatar_url',p.avatar_url))
      FROM employees e LEFT JOIN profiles p ON p.id = COALESCE(e.profile_id, e.user_id)
      WHERE COALESCE(e.data_admissao, p_data) <= p_data
        AND (e.data_demissao IS NULL OR e.data_demissao > p_data)
        AND (e.status = 'ativo' OR e.data_demissao IS NOT NULL)), '[]'),
    'vinculos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',h.id,'employee_id',h.employee_id,
        'cargo_id',h.cargo_catalogo_id,'departamento_id',h.departamento_id,'data_inicio',h.data_inicio,
        'data_fim',h.data_fim,'interino',h.interino) ORDER BY h.data_inicio)
      FROM employee_cargo_historico h), '[]')
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.gov_estrutura_em(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gov_estrutura_em(date) TO authenticated;

-- Escrita (RH/admin)
CREATE OR REPLACE FUNCTION public.gov_estrutura_mover(p_tipo text, p_id uuid, p_novo_pai uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT gov_is_rh_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente RH ou administrador' USING ERRCODE='42501'; END IF;
  IF p_tipo = 'setor' THEN UPDATE departamentos SET parent_id = p_novo_pai WHERE id = p_id;
  ELSIF p_tipo = 'cargo' THEN UPDATE cargos_catalogo SET reporta_a_cargo_id = p_novo_pai WHERE id = p_id;
  ELSE RAISE EXCEPTION 'Tipo inválido'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gov_setor_salvar(p_id uuid, p_nome text, p_parent_id uuid, p_responsavel uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid := p_id;
BEGIN
  IF NOT gov_is_rh_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente RH ou administrador' USING ERRCODE='42501'; END IF;
  IF COALESCE(btrim(p_nome),'') = '' THEN RAISE EXCEPTION 'Informe o nome do setor'; END IF;
  IF v IS NULL THEN
    INSERT INTO departamentos(nome, parent_id, responsavel_employee_id, ativo) VALUES (btrim(p_nome), p_parent_id, p_responsavel, true) RETURNING id INTO v;
  ELSE
    UPDATE departamentos SET nome=btrim(p_nome), parent_id=p_parent_id, responsavel_employee_id=p_responsavel WHERE id=v;
  END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.gov_cargo_salvar(p_id uuid, p_nome text, p_departamento_id uuid, p_reporta_a uuid, p_nivel int, p_descricao text, p_faixa_min numeric, p_faixa_max numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid := p_id; v_area text;
BEGIN
  IF NOT gov_is_rh_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente RH ou administrador' USING ERRCODE='42501'; END IF;
  IF COALESCE(btrim(p_nome),'') = '' THEN RAISE EXCEPTION 'Informe o nome do cargo'; END IF;
  IF p_departamento_id IS NULL THEN RAISE EXCEPTION 'O cargo precisa ter um setor'; END IF;
  IF v IS NULL THEN
    SELECT nome INTO v_area FROM departamentos WHERE id = p_departamento_id;
    INSERT INTO cargos_catalogo(nome_exibicao, cargo_base, area, departamento_id, reporta_a_cargo_id, nivel, descricao, faixa_salarial_min, faixa_salarial_max)
    VALUES (btrim(p_nome), btrim(p_nome), COALESCE(v_area,''), p_departamento_id, p_reporta_a, p_nivel, p_descricao, p_faixa_min, p_faixa_max) RETURNING id INTO v;
  ELSE
    UPDATE cargos_catalogo SET nome_exibicao=btrim(p_nome), departamento_id=p_departamento_id, reporta_a_cargo_id=p_reporta_a,
      nivel=p_nivel, descricao=p_descricao, faixa_salarial_min=p_faixa_min, faixa_salarial_max=p_faixa_max WHERE id=v;
  END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.gov_vinculo_atribuir(p_employee_id uuid, p_cargo_id uuid, p_data_inicio date, p_interino boolean DEFAULT false, p_observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; v_dep uuid;
BEGIN
  IF NOT gov_is_rh_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente RH ou administrador' USING ERRCODE='42501'; END IF;
  IF p_data_inicio IS NULL THEN RAISE EXCEPTION 'Informe a data de início'; END IF;
  SELECT departamento_id INTO v_dep FROM cargos_catalogo WHERE id = p_cargo_id;
  IF NOT p_interino THEN
    UPDATE employee_cargo_historico SET data_fim = p_data_inicio - 1
     WHERE employee_id = p_employee_id AND data_fim IS NULL AND NOT interino AND data_inicio < p_data_inicio;
    UPDATE employees SET cargo_catalogo_id = p_cargo_id WHERE id = p_employee_id;
  END IF;
  INSERT INTO employee_cargo_historico(employee_id, cargo_catalogo_id, departamento_id, data_inicio, interino, observacao)
  VALUES (p_employee_id, p_cargo_id, v_dep, p_data_inicio, COALESCE(p_interino,false), p_observacao) RETURNING id INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.gov_vinculo_encerrar(p_vinculo_id uuid, p_data_fim date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT gov_is_rh_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente RH ou administrador' USING ERRCODE='42501'; END IF;
  IF p_data_fim IS NULL THEN RAISE EXCEPTION 'Informe a data de fim'; END IF;
  UPDATE employee_cargo_historico SET data_fim = p_data_fim WHERE id = p_vinculo_id AND data_fim IS NULL AND data_inicio <= p_data_fim;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo não encontrado, já encerrado ou data anterior ao início'; END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.gov_estrutura_mover(text,uuid,uuid), public.gov_setor_salvar(uuid,text,uuid,uuid),
  public.gov_cargo_salvar(uuid,text,uuid,uuid,int,text,numeric,numeric), public.gov_vinculo_atribuir(uuid,uuid,date,boolean,text),
  public.gov_vinculo_encerrar(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gov_estrutura_mover(text,uuid,uuid), public.gov_setor_salvar(uuid,text,uuid,uuid),
  public.gov_cargo_salvar(uuid,text,uuid,uuid,int,text,numeric,numeric), public.gov_vinculo_atribuir(uuid,uuid,date,boolean,text),
  public.gov_vinculo_encerrar(uuid,date) TO authenticated;