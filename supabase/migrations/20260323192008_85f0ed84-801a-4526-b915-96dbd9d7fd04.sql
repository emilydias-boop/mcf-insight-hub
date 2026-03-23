
-- Insert default permissions for assistente_administrativo and marketing roles
-- Using a DO block to handle conflicts gracefully
DO $$
BEGIN
  INSERT INTO role_permissions (role, resource, permission_level, bu) VALUES
    ('assistente_administrativo', 'dashboard', 'view', null),
    ('assistente_administrativo', 'configuracoes', 'view', null),
    ('assistente_administrativo', 'relatorios', 'view', null),
    ('assistente_administrativo', 'alertas', 'view', null),
    ('assistente_administrativo', 'playbook', 'view', null),
    ('assistente_administrativo', 'crm', 'view', null),
    ('marketing', 'dashboard', 'view', null),
    ('marketing', 'relatorios', 'view', null),
    ('marketing', 'alertas', 'view', null),
    ('marketing', 'playbook', 'view', null)
  ON CONFLICT DO NOTHING;
END $$;
