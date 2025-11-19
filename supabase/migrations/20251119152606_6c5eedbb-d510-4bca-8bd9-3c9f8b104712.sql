-- CORREÇÃO CRÍTICA DE SEGURANÇA - Proteger dados sensíveis (corrigido para views)

-- 1. CORRIGIR crm_contacts: Remover acesso público a 600+ registros
DROP POLICY IF EXISTS "Todos podem visualizar contatos" ON crm_contacts;

CREATE POLICY "Authenticated users can view contacts"
ON crm_contacts FOR SELECT
TO authenticated
USING (true);

-- 2. CORRIGIR profiles: Adicionar proteção explícita
DROP POLICY IF EXISTS "Deny unauthorized profile access" ON profiles;

CREATE POLICY "Deny unauthorized profile access"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 3. CORRIGIR crm_origins: Restringir acesso
DROP POLICY IF EXISTS "Todos podem visualizar origens" ON crm_origins;

CREATE POLICY "Authenticated users can view origins"
ON crm_origins FOR SELECT
TO authenticated
USING (true);

-- 4. CORRIGIR user_performance_summary: Recriar view com segurança embutida
DROP VIEW IF EXISTS user_performance_summary CASCADE;

CREATE VIEW user_performance_summary 
WITH (security_barrier = true) AS
SELECT 
  p.id as user_id,
  p.email,
  p.full_name,
  ur.role,
  ued.position,
  ued.hire_date,
  ued.is_active,
  ued.fixed_salary,
  ued.ote,
  COALESCE(red_flags.count, 0) as red_flags_count,
  COALESCE(yellow_flags.count, 0) as yellow_flags_count,
  COALESCE(achieved.count, 0) as targets_achieved,
  COALESCE(total_targets.count, 0) as total_targets,
  NULL::numeric as avg_performance_3m
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN user_employment_data ued ON ued.user_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*) as count 
  FROM user_flags 
  WHERE flag_type = 'red' AND is_resolved = false
  GROUP BY user_id
) red_flags ON red_flags.user_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*) as count 
  FROM user_flags 
  WHERE flag_type = 'yellow' AND is_resolved = false
  GROUP BY user_id
) yellow_flags ON yellow_flags.user_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*) as count 
  FROM user_targets 
  WHERE is_achieved = true
  GROUP BY user_id
) achieved ON achieved.user_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*) as count 
  FROM user_targets
  GROUP BY user_id
) total_targets ON total_targets.user_id = p.id
WHERE 
  -- Filtro de segurança: usuário vê apenas seus dados OU é admin/manager
  p.id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role);

COMMENT ON VIEW user_performance_summary IS 
'View protegida que expõe métricas de performance apenas para o próprio usuário ou admins/managers';
