-- Adicionar coluna count_in_dashboard na tabela hubla_transactions
ALTER TABLE hubla_transactions 
ADD COLUMN IF NOT EXISTS count_in_dashboard boolean DEFAULT true;

-- Criar índice para performance nas queries de dashboard
CREATE INDEX IF NOT EXISTS idx_hubla_transactions_count_dashboard 
ON hubla_transactions(count_in_dashboard) WHERE count_in_dashboard = true;

-- Permitir que managers e admins atualizem o campo count_in_dashboard
CREATE POLICY "Managers can update count_in_dashboard" 
ON hubla_transactions 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));