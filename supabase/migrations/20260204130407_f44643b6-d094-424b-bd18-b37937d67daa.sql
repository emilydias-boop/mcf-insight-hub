-- Adicionar grupo "Perpétuo - X1" ao mapeamento do Consórcio
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default)
VALUES ('consorcio', 'group', 'a6f3cbfc-0567-427f-a405-5a869aaa6010', false)
ON CONFLICT DO NOTHING;