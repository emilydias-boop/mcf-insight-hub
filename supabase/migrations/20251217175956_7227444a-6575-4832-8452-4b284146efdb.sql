-- RLS Policies para permitir que colaboradores acessem seus próprios dados

-- 1. Colaborador pode ver seu próprio registro em employees
CREATE POLICY "Colaborador pode ver seus dados" ON employees
  FOR SELECT USING (user_id = auth.uid());

-- 2. Colaborador pode ver seus documentos visíveis
CREATE POLICY "Colaborador pode ver seus documentos visiveis" ON employee_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.id = employee_documents.employee_id 
      AND employees.user_id = auth.uid()
    ) 
    AND visivel_colaborador = true
  );

-- 3. Colaborador pode inserir documentos para si mesmo
CREATE POLICY "Colaborador pode enviar seus documentos" ON employee_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.id = employee_id 
      AND employees.user_id = auth.uid()
    )
  );

-- 4. Colaborador pode ver seus eventos
CREATE POLICY "Colaborador pode ver seus eventos" ON employee_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.id = employee_events.employee_id 
      AND employees.user_id = auth.uid()
    )
  );

-- 5. Colaborador pode ver notas não-privadas
CREATE POLICY "Colaborador pode ver notas nao privadas" ON employee_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.id = employee_notes.employee_id 
      AND employees.user_id = auth.uid()
    ) 
    AND privada = false
  );

-- 6. Colaborador pode ver suas NFSe
CREATE POLICY "Colaborador pode ver suas NFSe" ON rh_nfse
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.id = rh_nfse.employee_id 
      AND employees.user_id = auth.uid()
    )
  );

-- 7. Colaborador pode inserir suas NFSe
CREATE POLICY "Colaborador pode inserir suas NFSe" ON rh_nfse
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.id = employee_id 
      AND employees.user_id = auth.uid()
    )
  );