-- Adicionar coluna role_sistema em cargos_catalogo
ALTER TABLE cargos_catalogo 
ADD COLUMN IF NOT EXISTS role_sistema TEXT DEFAULT 'viewer';

-- Preencher mapeamentos conhecidos baseado em cargo_base
UPDATE cargos_catalogo SET role_sistema = 'sdr' WHERE LOWER(cargo_base) = 'sdr';
UPDATE cargos_catalogo SET role_sistema = 'closer' WHERE LOWER(cargo_base) = 'closer';
UPDATE cargos_catalogo SET role_sistema = 'coordenador' WHERE LOWER(cargo_base) IN ('coordenador', 'supervisor');
UPDATE cargos_catalogo SET role_sistema = 'manager' WHERE LOWER(cargo_base) IN ('gerente de contas', 'head de relacionamento', 'gerente', 'head');
UPDATE cargos_catalogo SET role_sistema = 'admin' WHERE LOWER(cargo_base) IN ('diretor', 'diretora', 'ceo', 'coo', 'cfo');
UPDATE cargos_catalogo SET role_sistema = 'financeiro' WHERE LOWER(area) = 'financeiro' AND role_sistema = 'viewer';
UPDATE cargos_catalogo SET role_sistema = 'rh' WHERE LOWER(area) = 'rh' AND role_sistema = 'viewer';

-- Comentário explicativo
COMMENT ON COLUMN cargos_catalogo.role_sistema IS 'Role de acesso ao sistema derivado do cargo (admin, manager, sdr, closer, coordenador, financeiro, rh, viewer)';