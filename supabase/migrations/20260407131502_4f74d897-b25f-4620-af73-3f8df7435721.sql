
-- 1. Atualizar policy de SDRs para usar is_own_sdr() (suporta match por email)
DROP POLICY IF EXISTS "SDRs podem ver seus próprios planos" ON sdr_comp_plan;
CREATE POLICY "SDRs podem ver seus próprios planos"
  ON sdr_comp_plan FOR SELECT
  TO authenticated
  USING (is_own_sdr(sdr_id));

-- 2. Adicionar manager à policy administrativa
DROP POLICY IF EXISTS "Admins e coordenadores podem ver todos os planos" ON sdr_comp_plan;
CREATE POLICY "Admins coordenadores e managers podem ver todos os planos"
  ON sdr_comp_plan FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'coordenador') OR 
    has_role(auth.uid(), 'manager')
  );
