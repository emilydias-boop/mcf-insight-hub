-- Passo 1: Ajustar política de INSERT em deal_activities
-- Permitir insert se user_id é null (banco preenche via default) ou é o próprio usuário
DROP POLICY IF EXISTS "Users can create activities" ON deal_activities;

CREATE POLICY "Users can create activities" 
ON deal_activities FOR INSERT 
TO public 
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (user_id IS NULL OR user_id::text = auth.uid()::text)
);

-- Passo 2: Adicionar política de UPDATE para SDRs em crm_deals
-- Permitir que SDRs atualizem deals (mover estágios, salvar qualificação)
DROP POLICY IF EXISTS "SDRs podem atualizar deals" ON crm_deals;

CREATE POLICY "SDRs podem atualizar deals"
ON crm_deals FOR UPDATE 
TO public
USING (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'manager'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sdr'::app_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'manager'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sdr'::app_role)
  )
);