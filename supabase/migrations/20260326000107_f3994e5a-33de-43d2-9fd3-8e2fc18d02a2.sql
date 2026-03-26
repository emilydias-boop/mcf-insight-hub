DROP VIEW IF EXISTS user_performance_summary;

CREATE VIEW user_performance_summary AS
SELECT 
  p.id AS user_id,
  p.email,
  p.full_name,
  (
    SELECT ur.role FROM user_roles ur 
    WHERE ur.user_id = p.id 
    ORDER BY 
      CASE ur.role
        WHEN 'admin' THEN 1
        WHEN 'manager' THEN 2
        WHEN 'coordenador' THEN 3
        WHEN 'closer' THEN 4
        WHEN 'closer_sombra' THEN 5
        WHEN 'financeiro' THEN 6
        WHEN 'rh' THEN 7
        WHEN 'marketing' THEN 8
        WHEN 'gr' THEN 9
        WHEN 'assistente_administrativo' THEN 10
        WHEN 'sdr' THEN 11
        WHEN 'viewer' THEN 12
        ELSE 99
      END
    LIMIT 1
  ) AS role,
  ued."position",
  ued.department,
  ued.hire_date,
  CASE 
    WHEN p.access_status = 'desativado' THEN false
    WHEN p.access_status = 'bloqueado' THEN false
    ELSE COALESCE(ued.is_active, true)
  END AS is_active,
  COALESCE(ued.status, 'ativo'::user_status) AS status,
  ued.fixed_salary,
  ued.ote,
  ued.commission_rate
FROM profiles p
LEFT JOIN user_employment_data ued ON ued.user_id = p.id;