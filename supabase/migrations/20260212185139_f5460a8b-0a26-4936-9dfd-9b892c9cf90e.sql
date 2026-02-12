-- 1. Corrigir RLS para closers
DROP POLICY IF EXISTS "SDRs podem atualizar deals" ON crm_deals;
CREATE POLICY "SDRs e closers podem atualizar deals" ON crm_deals
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'manager'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'sdr'::app_role) OR
      has_role(auth.uid(), 'closer'::app_role)
    )
  ) WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'manager'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'sdr'::app_role) OR
      has_role(auth.uid(), 'closer'::app_role)
    )
  );

-- 2. Criar estagio No-Show na pipeline Consorcio (com clint_id e stage_order obrigatórios)
INSERT INTO crm_stages (origin_id, stage_name, clint_id, stage_order)
VALUES ('57013597-22f6-4969-848c-404b81dcc0cb', 'No-Show', 'noshow-consorcio-auto', 9);