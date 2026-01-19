-- Atualizar permissões de SDR para VER estágios avançados (read-only)
-- SDRs poderão ver leads em R1 Realizada, R2, Contrato Pago, Venda Realizada
-- mas NÃO poderão editar ou mover deals desses estágios

UPDATE stage_permissions
SET can_view = true
WHERE role = 'sdr'
AND stage_id IN (
  'r1_realizada',
  'r2_agendada', 
  'r2_realizada',
  'contrato_pago',
  'venda_realizada'
);

-- Confirmar que "sem_interesse" está visível para SDRs (já está, mas garantir)
UPDATE stage_permissions
SET can_view = true
WHERE role = 'sdr'
AND stage_id = 'sem_interesse';