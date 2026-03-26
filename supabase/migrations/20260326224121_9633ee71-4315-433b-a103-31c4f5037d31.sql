CREATE TABLE employee_pdi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'competencia' CHECK (categoria IN ('competencia', 'tecnico', 'comportamental', 'lideranca', 'outro')),
  status TEXT NOT NULL DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido', 'cancelado')),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  data_inicio DATE,
  data_prevista DATE,
  data_conclusao DATE,
  progresso INTEGER NOT NULL DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE employee_pdi_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id UUID NOT NULL REFERENCES employee_pdi(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  autor_nome TEXT,
  autor_tipo TEXT NOT NULL DEFAULT 'rh' CHECK (autor_tipo IN ('colaborador', 'gestor', 'rh')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE employee_pdi ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_pdi_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee can view own PDIs" ON employee_pdi FOR SELECT TO authenticated USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "Authenticated can insert PDI" ON employee_pdi FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update PDI" ON employee_pdi FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Employee can view own PDI comments" ON employee_pdi_comments FOR SELECT TO authenticated USING (pdi_id IN (SELECT ep.id FROM employee_pdi ep JOIN employees e ON e.id = ep.employee_id WHERE e.user_id = auth.uid()));
CREATE POLICY "Employee can insert PDI comments" ON employee_pdi_comments FOR INSERT TO authenticated WITH CHECK (pdi_id IN (SELECT ep.id FROM employee_pdi ep JOIN employees e ON e.id = ep.employee_id WHERE e.user_id = auth.uid()));