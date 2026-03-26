
-- Gestão de Tempo
CREATE TABLE employee_time_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ferias','ausencia_justificada','ausencia_injustificada','atestado','licenca')),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  dias INT,
  motivo TEXT,
  anexo_path TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE employee_time_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read time records" ON employee_time_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert time records" ON employee_time_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update time records" ON employee_time_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete time records" ON employee_time_records FOR DELETE TO authenticated USING (true);

-- Compliance
CREATE TABLE employee_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('advertencia','descumprimento_politica','investigacao','flag_risco')),
  severidade TEXT NOT NULL CHECK (severidade IN ('leve','media','grave')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_ocorrencia DATE NOT NULL,
  anexo_path TEXT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','encerrado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE employee_compliance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read compliance" ON employee_compliance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert compliance" ON employee_compliance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update compliance" ON employee_compliance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete compliance" ON employee_compliance FOR DELETE TO authenticated USING (true);
