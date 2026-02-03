-- Inserir origem padrão do Consórcio no mapeamento de BU
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default)
VALUES ('consorcio', 'origin', '57013597-22f6-4969-848c-404b81dcc0cb', true)
ON CONFLICT DO NOTHING;