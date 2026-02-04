-- Adicionar a pipeline "PIPELINE - INSIDE SALES - VIVER DE ALUGUEL" ao mapeamento do Consórcio
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default)
VALUES ('consorcio', 'origin', '4e2b810a-6782-4ce9-9c0d-10d04c018636', false)
ON CONFLICT DO NOTHING;