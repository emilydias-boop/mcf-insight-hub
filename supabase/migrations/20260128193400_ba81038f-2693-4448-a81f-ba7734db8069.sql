-- Tabela de provas/avaliações
CREATE TABLE employee_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_aplicacao DATE DEFAULT CURRENT_DATE,
  aplicador_id UUID REFERENCES auth.users(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de notas
CREATE TABLE employee_exam_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES employee_exams(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  nota DECIMAL(5,2) NOT NULL CHECK (nota >= 0 AND nota <= 10),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(exam_id, employee_id)
);

-- RLS
ALTER TABLE employee_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_exam_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read exams" ON employee_exams FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert exams" ON employee_exams FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update exams" ON employee_exams FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete exams" ON employee_exams FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Auth read scores" ON employee_exam_scores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert scores" ON employee_exam_scores FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update scores" ON employee_exam_scores FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete scores" ON employee_exam_scores FOR DELETE USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE TRIGGER update_employee_exams_updated_at
  BEFORE UPDATE ON employee_exams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fechamento_metricas_updated_at();

CREATE TRIGGER update_employee_exam_scores_updated_at
  BEFORE UPDATE ON employee_exam_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fechamento_metricas_updated_at();