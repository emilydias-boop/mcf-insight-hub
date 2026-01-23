-- Inserir permissões para o closer_sombra (somente visualização)
INSERT INTO role_permissions (role, resource, permission_level) VALUES
('closer_sombra', 'alertas', 'view'),
('closer_sombra', 'configuracoes', 'none'),
('closer_sombra', 'credito', 'none'),
('closer_sombra', 'crm', 'view'),
('closer_sombra', 'custos', 'none'),
('closer_sombra', 'dashboard', 'none'),
('closer_sombra', 'efeito_alavanca', 'none'),
('closer_sombra', 'fechamento_sdr', 'none'),
('closer_sombra', 'financeiro', 'none'),
('closer_sombra', 'leilao', 'none'),
('closer_sombra', 'projetos', 'none'),
('closer_sombra', 'receita', 'none'),
('closer_sombra', 'relatorios', 'none'),
('closer_sombra', 'tv_sdr', 'view'),
('closer_sombra', 'usuarios', 'none');

-- Atualizar Victoria Paz
UPDATE profiles 
SET full_name = 'Victoria Paz'
WHERE email = 'victoria.paz@minhacasafinanciada.com';

-- Atualizar role da Victoria para closer_sombra
UPDATE user_roles 
SET role = 'closer_sombra'
WHERE user_id = '5a702a6c-52ef-410b-be39-8a1cda4f10d3';