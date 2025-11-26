-- Adicionar "coordenador" ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'coordenador';

-- Adicionar UNIQUE constraint em user_roles.user_id para permitir upsert
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);