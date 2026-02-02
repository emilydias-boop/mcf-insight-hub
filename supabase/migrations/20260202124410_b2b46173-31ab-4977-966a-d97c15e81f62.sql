-- Adicionar coluna para congelar departamento no momento do fechamento
ALTER TABLE sdr_month_payout 
ADD COLUMN departamento_vigente TEXT;

COMMENT ON COLUMN sdr_month_payout.departamento_vigente IS 
  'Departamento do colaborador no momento do fechamento (fonte: employees.departamento)';