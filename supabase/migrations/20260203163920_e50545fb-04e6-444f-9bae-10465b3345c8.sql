
-- Corrigir departamento da Victoria Paz para aparecer nas configurações
UPDATE employees 
SET departamento = 'BU - Consórcio', updated_at = now()
WHERE nome_completo ILIKE '%victoria%paz%'
  AND (departamento IS NULL OR departamento = 'Consorcio' OR departamento != 'BU - Consórcio');
