-- Adicionar coluna modo_entrada para controlar se KPIs são automáticos ou manuais
ALTER TABLE sdr_month_kpi 
ADD COLUMN IF NOT EXISTS modo_entrada TEXT DEFAULT 'auto' 
CHECK (modo_entrada IN ('auto', 'manual'));

COMMENT ON COLUMN sdr_month_kpi.modo_entrada IS 'auto = sincroniza do Clint, manual = entrada pelo coordenador';