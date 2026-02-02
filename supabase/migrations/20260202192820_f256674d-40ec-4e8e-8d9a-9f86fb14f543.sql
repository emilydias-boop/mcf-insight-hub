-- Tabela para mapeamento dinâmico BU → Origins/Groups
CREATE TABLE bu_origin_mapping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bu TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('group', 'origin')),
  entity_id UUID NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bu, entity_type, entity_id)
);

-- Índices para performance
CREATE INDEX idx_bu_origin_mapping_bu ON bu_origin_mapping(bu);
CREATE INDEX idx_bu_origin_mapping_entity ON bu_origin_mapping(entity_type, entity_id);

-- RLS
ALTER TABLE bu_origin_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar bu_origin_mapping"
ON bu_origin_mapping FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Todos podem ler bu_origin_mapping"
ON bu_origin_mapping FOR SELECT
USING (TRUE);

-- Migrar dados existentes do código hardcoded
-- Incorporador
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default) VALUES
  ('incorporador', 'group', 'a6f3cbfc-0567-427f-a405-5a869aaa6010', TRUE),
  ('incorporador', 'origin', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', TRUE);

-- Consórcio
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default) VALUES
  ('consorcio', 'group', 'b98e3746-d727-445b-b878-fc5742b6e6b8', TRUE),
  ('consorcio', 'group', '267905ec-8fcf-4373-8d62-273bb6c6f8ca', FALSE),
  ('consorcio', 'group', '35361575-d8a9-4ea0-8703-372a2988d2be', FALSE),
  ('consorcio', 'origin', '4e2b810a-6782-4ce9-9c0d-10d04c018636', TRUE);