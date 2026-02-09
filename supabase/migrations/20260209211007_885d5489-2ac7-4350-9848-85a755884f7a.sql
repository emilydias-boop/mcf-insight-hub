
-- Permitir que SDRs, Closers e Managers vejam todos os registros da tabela sdr
-- Isso corrige o problema onde useSdrsFromSquad retorna apenas o próprio registro
CREATE POLICY "SDRs e Closers podem ver lista de SDRs"
ON public.sdr FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'sdr') OR 
  has_role(auth.uid(), 'closer') OR 
  has_role(auth.uid(), 'manager')
);
