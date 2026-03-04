-- Fix 1: Copy metrics from 2026-02 (squad=incorporador) to 2026-03
INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, squad, nome_metrica, label_exibicao, peso_percentual, meta_valor, meta_percentual, fonte_dados, ativo)
SELECT '2026-03', cargo_catalogo_id, squad, nome_metrica, label_exibicao, peso_percentual, meta_valor, meta_percentual, fonte_dados, ativo
FROM fechamento_metricas_mes
WHERE ano_mes = '2026-02' AND squad = 'incorporador';

-- Fix 3: Delete duplicate feb metrics (squad=NULL where squad='incorporador' exists for same cargo)
DELETE FROM fechamento_metricas_mes 
WHERE id IN (
  '857e4111-9685-43d6-9b1a-18f27d00b250',
  '1cfc4d7a-1df7-4d2b-a892-6dd03424bd4f',
  '0282e628-bcc6-437b-98f4-f0f06957d7bf',
  '93507c80-9ea9-46c0-b792-42c0c16a9318',
  '11aba2a0-69ce-4804-8765-475fe875266d',
  '3254ad8f-e640-452e-8be3-544b299395b3',
  '9e93c918-f738-406e-be3d-f9075ac85e81',
  '47e8f629-e1a1-4c46-b21b-0395839e7745'
);