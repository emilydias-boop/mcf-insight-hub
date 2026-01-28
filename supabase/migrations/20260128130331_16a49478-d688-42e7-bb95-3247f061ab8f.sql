-- Remover constraint que impede múltiplas roles por usuário
-- (já existe user_roles_user_id_role_key que garante unicidade por role)
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_unique;

-- Adicionar role de closer para Jessica (mantendo sdr)
INSERT INTO user_roles (user_id, role)
VALUES ('b0ea004d-ca72-4190-ab69-a9685b34bd06', 'closer')
ON CONFLICT (user_id, role) DO NOTHING;