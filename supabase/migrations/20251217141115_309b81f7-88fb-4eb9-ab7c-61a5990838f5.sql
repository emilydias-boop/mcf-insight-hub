
-- Migração de dados existentes para o módulo de RH

-- 1. Migrar usuários de user_employment_data para employees
INSERT INTO employees (
  user_id,
  profile_id,
  nome_completo,
  cargo,
  departamento,
  salario_base,
  data_admissao,
  data_demissao,
  status,
  created_at
)
SELECT 
  ued.user_id,
  ued.user_id as profile_id,
  COALESCE(p.full_name, 'Nome não informado'),
  ued.position,
  ued.department,
  ued.fixed_salary,
  ued.hire_date,
  ued.termination_date,
  CASE WHEN ued.is_active = true THEN 'ativo' ELSE 'inativo' END,
  ued.created_at
FROM user_employment_data ued
JOIN profiles p ON p.id = ued.user_id
ON CONFLICT DO NOTHING;

-- 2. Migrar SDRs para employees (apenas os que não existem ainda)
INSERT INTO employees (
  sdr_id,
  nome_completo,
  email_pessoal,
  cargo,
  departamento,
  nivel,
  status,
  created_at
)
SELECT 
  s.id as sdr_id,
  s.name as nome_completo,
  s.email as email_pessoal,
  'SDR' as cargo,
  'BU - Incorporador 50K' as departamento,
  s.nivel,
  CASE WHEN s.active = true THEN 'ativo' ELSE 'inativo' END as status,
  s.created_at
FROM sdr s
WHERE NOT EXISTS (
  SELECT 1 FROM employees e WHERE e.sdr_id = s.id OR e.user_id = s.user_id
)
ON CONFLICT DO NOTHING;

-- 3. Atualizar employees existentes com sdr_id quando o email coincidir
UPDATE employees e
SET sdr_id = s.id,
    nivel = COALESCE(e.nivel, s.nivel)
FROM sdr s
WHERE (LOWER(e.email_pessoal) = LOWER(s.email) OR e.user_id = s.user_id)
AND e.sdr_id IS NULL;

-- 4. Migrar arquivos de user_files para employee_documents (usando nomes corretos das colunas)
INSERT INTO employee_documents (
  employee_id,
  tipo_documento,
  titulo,
  descricao,
  storage_path,
  storage_url,
  visivel_colaborador,
  status,
  uploaded_by,
  created_at
)
SELECT 
  e.id as employee_id,
  uf.tipo::text as tipo_documento,
  uf.titulo,
  uf.descricao,
  uf.storage_path,
  uf.storage_url,
  uf.visivel_para_usuario as visivel_colaborador,
  'aprovado' as status,
  uf.uploaded_by,
  uf.created_at
FROM user_files uf
JOIN employees e ON e.user_id = uf.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM employee_documents ed 
  WHERE ed.employee_id = e.id 
  AND ed.storage_path = uf.storage_path
);
