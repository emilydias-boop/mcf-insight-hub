-- Drop and recreate view with COALESCE defaults for users without employment data
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
  COALESCE(ued.is_active, true) AS is_active,
  COALESCE(ued.status, 'ativo'::user_status) AS status,
  ued.fixed_salary,
  ued.ote,
  ued.commission_rate
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN user_employment_data ued ON ued.user_id = p.id;

-- Insert default employment data for users without records
INSERT INTO user_employment_data (user_id, status, is_active)
SELECT p.id, 'ativo'::user_status, true
FROM profiles p
LEFT JOIN user_employment_data ued ON ued.user_id = p.id
WHERE ued.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;