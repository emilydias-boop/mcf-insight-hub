-- Migração: Criar registros SDR para funcionários da BU Consórcio sem vínculo
-- Exclui: Closer R2 (Thobson - sócio)

-- 1. Criar registros na tabela sdr para funcionários sem vínculo
INSERT INTO sdr (id, name, email, squad, role_type, active, meta_diaria, nivel, status)
SELECT 
  gen_random_uuid(),
  e.nome_completo,
  e.email_pessoal,
  'consorcio',
  CASE 
    WHEN e.cargo ILIKE '%Closer%' THEN 'closer'
    WHEN e.cargo ILIKE '%Supervisor%' THEN 'sdr'
    ELSE 'sdr'
  END,
  true,
  3,
  COALESCE(cc.nivel, 1),
  'APPROVED'
FROM employees e
LEFT JOIN cargos_catalogo cc ON e.cargo_catalogo_id = cc.id
WHERE e.departamento = 'BU - Consórcio'
  AND e.status = 'ativo'
  AND e.sdr_id IS NULL
  AND e.cargo NOT ILIKE '%Closer R2%'
ON CONFLICT DO NOTHING;

-- 2. Vincular employees.sdr_id aos novos registros criados
UPDATE employees e
SET sdr_id = s.id
FROM sdr s
WHERE e.departamento = 'BU - Consórcio'
  AND e.status = 'ativo'
  AND e.sdr_id IS NULL
  AND e.cargo NOT ILIKE '%Closer R2%'
  AND LOWER(TRIM(e.nome_completo)) = LOWER(TRIM(s.name))
  AND s.squad = 'consorcio';