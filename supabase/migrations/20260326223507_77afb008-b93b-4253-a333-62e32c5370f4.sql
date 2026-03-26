
CREATE TABLE rh_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ocorrencia', 'solicitacao', 'sugestao')),
  assunto TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'encaminhado' CHECK (status IN ('encaminhado', 'em_avaliacao', 'finalizado')),
  resposta_rh TEXT,
  respondido_por UUID REFERENCES auth.users(id),
  anexo_url TEXT,
  anexo_storage_path TEXT,
  data_abertura TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_encerramento TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rh_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee can view own tickets"
  ON rh_tickets FOR SELECT TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Employee can create own tickets"
  ON rh_tickets FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Employee can update own tickets"
  ON rh_tickets FOR UPDATE TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));
