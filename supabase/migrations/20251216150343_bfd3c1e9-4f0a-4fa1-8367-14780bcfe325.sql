
-- Habilitar transações P2 do Osvaldo e Thales que estão desabilitadas
UPDATE hubla_transactions
SET count_in_dashboard = true, updated_at = now()
WHERE id IN (
  'fb17cd63-b67d-4d73-9107-5180641df87a',  -- Osvaldo P2 R$4.320,57
  '2bfcbc45-6a9f-4189-a1ce-130ed2029d58'   -- Thales P2 R$5.162,86
);
