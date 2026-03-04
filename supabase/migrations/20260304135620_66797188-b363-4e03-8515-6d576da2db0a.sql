ALTER TABLE sdr_comp_plan ADD COLUMN IF NOT EXISTS cargo_catalogo_id uuid REFERENCES cargos_catalogo(id);

-- Backfill existing comp_plans by matching OTE+fixo values
UPDATE sdr_comp_plan cp
SET cargo_catalogo_id = (
  SELECT cc.id FROM cargos_catalogo cc
  WHERE cc.ote_total = cp.ote_total
    AND cc.fixo_valor = cp.fixo_valor
    AND cc.ativo = true
  ORDER BY cc.nivel ASC
  LIMIT 1
)
WHERE cp.cargo_catalogo_id IS NULL;