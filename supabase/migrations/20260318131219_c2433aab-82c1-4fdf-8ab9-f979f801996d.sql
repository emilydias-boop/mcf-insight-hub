DROP VIEW IF EXISTS user_performance_summary;

CREATE VIEW user_performance_summary AS
SELECT 
  p.id AS user_id,
  p.email,
  p.full_name,
  ur.role,
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
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN user_employment_data ued ON ued.user_id = p.id;