-- Corrigir ifood_ultrameta para R$ 1000 em todos os SDRs/Closers elegíveis
-- do Inside Incorporador para janeiro/2026 (Ultrameta batida: R$ 5M > R$ 1.6M meta)

UPDATE sdr_month_payout p
SET 
  ifood_ultrameta = 1000,
  total_ifood = COALESCE(ifood_mensal, 0) + 1000,
  updated_at = NOW()
FROM sdr s
WHERE p.sdr_id = s.id
  AND p.ano_mes = '2026-01'
  AND s.squad = 'incorporador'
  AND s.active = true
  AND p.status != 'LOCKED'
  AND EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.sdr_id = s.id 
    AND e.status = 'ativo'
    AND (e.data_admissao IS NULL OR e.data_admissao < '2026-01-01')
  );