-- Remover métricas antigas sem squad para SDR Consórcio 2026-01
-- Isso evita que o sistema pegue os pesos errados (25%) em vez dos corretos (35%/55%/10%)
DELETE FROM fechamento_metricas_mes 
WHERE cargo_catalogo_id = '48f6d1ce-2fc3-47a0-859a-cfed0da32715'
  AND ano_mes = '2026-01'
  AND squad IS NULL;