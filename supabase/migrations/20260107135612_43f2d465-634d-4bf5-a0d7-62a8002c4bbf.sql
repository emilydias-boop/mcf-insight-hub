-- Vincular SDRs do Inside Sales (BU - Incorporador 50K) ao cargo do catálogo
UPDATE employees e
SET cargo_catalogo_id = (
  SELECT c.id FROM cargos_catalogo c 
  WHERE c.area = 'Inside Sales' 
    AND c.cargo_base = 'SDR' 
    AND c.nivel = e.nivel
  LIMIT 1
)
WHERE e.cargo = 'SDR' 
  AND e.departamento = 'BU - Incorporador 50K'
  AND e.status = 'ativo'
  AND e.cargo_catalogo_id IS NULL;

-- Vincular Closers do Inside Sales
UPDATE employees e
SET cargo_catalogo_id = (
  SELECT c.id FROM cargos_catalogo c 
  WHERE c.area = 'Inside Sales' 
    AND c.cargo_base = 'Closer'
  LIMIT 1
)
WHERE e.cargo = 'Closer' 
  AND e.departamento = 'BU - Incorporador 50K'
  AND e.status = 'ativo'
  AND e.cargo_catalogo_id IS NULL;

-- Vincular Coordenadora de Vendas
UPDATE employees e
SET cargo_catalogo_id = (
  SELECT c.id FROM cargos_catalogo c 
  WHERE c.area = 'Inside Sales' 
    AND c.cargo_base = 'Coordenador'
  LIMIT 1
)
WHERE e.cargo = 'Coordenadora de Vendas' 
  AND e.departamento = 'BU - Incorporador 50K'
  AND e.status = 'ativo'
  AND e.cargo_catalogo_id IS NULL;