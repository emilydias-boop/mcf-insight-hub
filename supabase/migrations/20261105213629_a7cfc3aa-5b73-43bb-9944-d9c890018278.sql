ALTER TABLE public.departamentos
  ADD COLUMN IF NOT EXISTS responsavel_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL;

ALTER TABLE public.cargos_catalogo
  ADD COLUMN IF NOT EXISTS departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reporta_a_cargo_id uuid REFERENCES public.cargos_catalogo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS faixa_salarial_min numeric,
  ADD COLUMN IF NOT EXISTS faixa_salarial_max numeric;

CREATE OR REPLACE FUNCTION public.gov_is_rh_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(_uid,'admin') OR public.has_role(_uid,'rh')
$$;

CREATE TABLE public.employee_cargo_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  cargo_catalogo_id uuid NOT NULL REFERENCES public.cargos_catalogo(id),
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  data_inicio date NOT NULL DEFAULT current_date,
  data_fim date,
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.employee_cargo_historico(employee_id) WHERE data_fim IS NULL;
CREATE INDEX ON public.employee_cargo_historico(cargo_catalogo_id) WHERE data_fim IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_cargo_historico TO authenticated;
GRANT ALL ON public.employee_cargo_historico TO service_role;
ALTER TABLE public.employee_cargo_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gov_ech_read" ON public.employee_cargo_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "gov_ech_write" ON public.employee_cargo_historico FOR ALL TO authenticated
  USING (public.gov_is_rh_admin(auth.uid())) WITH CHECK (public.gov_is_rh_admin(auth.uid()));

INSERT INTO public.employee_cargo_historico (employee_id, cargo_catalogo_id, data_inicio, observacao, created_by)
SELECT e.id, e.cargo_catalogo_id, COALESCE(e.data_admissao, current_date), 'Carga inicial a partir do cadastro atual', NULL
FROM public.employees e WHERE e.status='ativo' AND e.cargo_catalogo_id IS NOT NULL;

CREATE TABLE public.gov_alcadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  aplica_em text NOT NULL CHECK (aplica_em IN ('contratacao','desligamento','ambos')),
  cond_aumento_quadro boolean,
  cond_salario_acima numeric,
  cond_tipos_desligamento text[],
  cond_departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  aprovador_tipo text NOT NULL CHECK (aprovador_tipo IN ('cargo','setor','papel','colaborador')),
  aprovador_cargo_id uuid REFERENCES public.cargos_catalogo(id) ON DELETE SET NULL,
  aprovador_departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  aprovador_role public.app_role,
  aprovador_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  rotulo_papel text NOT NULL DEFAULT 'Alçada',
  ordem int NOT NULL DEFAULT 100,
  sla_dias int NOT NULL DEFAULT 2,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gov_alcadas TO authenticated;
GRANT ALL ON public.gov_alcadas TO service_role;
ALTER TABLE public.gov_alcadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gov_alc_read" ON public.gov_alcadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "gov_alc_write" ON public.gov_alcadas FOR ALL TO authenticated
  USING (public.gov_is_rh_admin(auth.uid())) WITH CHECK (public.gov_is_rh_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.gov_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_gov_ech_touch BEFORE UPDATE ON public.employee_cargo_historico FOR EACH ROW EXECUTE FUNCTION public.gov_touch();
CREATE TRIGGER trg_gov_alc_touch BEFORE UPDATE ON public.gov_alcadas FOR EACH ROW EXECUTE FUNCTION public.gov_touch();

-- Ocupante atual de um cargo (mais antigo no cargo primeiro)
CREATE OR REPLACE FUNCTION public.gov_ocupante_cargo(_cargo_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(
    (SELECT h.employee_id FROM employee_cargo_historico h JOIN employees e ON e.id=h.employee_id
      WHERE h.cargo_catalogo_id=_cargo_id AND h.data_fim IS NULL AND e.status='ativo'
      ORDER BY h.data_inicio LIMIT 1),
    (SELECT e.id FROM employees e WHERE e.cargo_catalogo_id=_cargo_id AND e.status='ativo'
      ORDER BY e.data_admissao NULLS LAST LIMIT 1))
$$;

-- Superior imediato: cargo "reporta a" → ocupante; senão gestor_id
CREATE OR REPLACE FUNCTION public.gov_superior_imediato(_employee_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cargo uuid; v_sup_cargo uuid; v_sup uuid;
BEGIN
  SELECT COALESCE(
    (SELECT cargo_catalogo_id FROM employee_cargo_historico WHERE employee_id=_employee_id AND data_fim IS NULL ORDER BY data_inicio DESC LIMIT 1),
    (SELECT cargo_catalogo_id FROM employees WHERE id=_employee_id)) INTO v_cargo;
  IF v_cargo IS NOT NULL THEN
    SELECT reporta_a_cargo_id INTO v_sup_cargo FROM cargos_catalogo WHERE id=v_cargo;
    IF v_sup_cargo IS NOT NULL THEN
      v_sup := gov_ocupante_cargo(v_sup_cargo);
      IF v_sup IS NOT NULL AND v_sup <> _employee_id THEN RETURN v_sup; END IF;
    END IF;
  END IF;
  SELECT g.id INTO v_sup FROM employees e JOIN employees g ON g.id=e.gestor_id AND g.status='ativo'
   WHERE e.id=_employee_id AND e.gestor_id <> e.id;
  RETURN v_sup;
END $$;

-- Responsável do setor do colaborador (sobe para o setor pai se vazio)
CREATE OR REPLACE FUNCTION public.gov_responsavel_setor(_departamento_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH RECURSIVE s AS (
    SELECT id, parent_id, responsavel_employee_id, 0 d FROM departamentos WHERE id=_departamento_id
    UNION ALL SELECT p.id, p.parent_id, p.responsavel_employee_id, s.d+1 FROM departamentos p JOIN s ON p.id=s.parent_id WHERE s.d<10)
  SELECT s.responsavel_employee_id FROM s JOIN employees e ON e.id=s.responsavel_employee_id AND e.status='ativo'
  ORDER BY d LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.gov_setor_do_colaborador(_employee_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(
    (SELECT h.departamento_id FROM employee_cargo_historico h WHERE h.employee_id=_employee_id AND h.data_fim IS NULL AND h.departamento_id IS NOT NULL ORDER BY data_inicio DESC LIMIT 1),
    (SELECT c.departamento_id FROM employees e JOIN cargos_catalogo c ON c.id=e.cargo_catalogo_id WHERE e.id=_employee_id),
    (SELECT d.id FROM employees e JOIN departamentos d ON lower(trim(d.nome))=lower(trim(e.departamento)) WHERE e.id=_employee_id LIMIT 1))
$$;

-- Cadeia hierárquica completa (nível 1 = superior imediato)
CREATE OR REPLACE FUNCTION public.gov_cadeia_hierarquica(_employee_id uuid)
RETURNS TABLE(nivel int, employee_id uuid, nome text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE cur uuid := _employee_id; nxt uuid; i int := 0; vistos uuid[] := ARRAY[_employee_id];
BEGIN
  LOOP
    nxt := gov_superior_imediato(cur);
    EXIT WHEN nxt IS NULL OR nxt = ANY(vistos) OR i >= 15;
    i := i + 1; vistos := vistos || nxt;
    nivel := i; employee_id := nxt; SELECT e.nome_completo INTO nome FROM employees e WHERE e.id=nxt;
    RETURN NEXT; cur := nxt;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.gov_is_rh_admin(uuid), public.gov_ocupante_cargo(uuid), public.gov_superior_imediato(uuid),
  public.gov_responsavel_setor(uuid), public.gov_setor_do_colaborador(uuid), public.gov_cadeia_hierarquica(uuid) TO authenticated;