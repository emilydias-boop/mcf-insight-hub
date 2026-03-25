-- Fix consorcio BU mapping: delete wrong entries and insert correct ones
DELETE FROM bu_origin_mapping WHERE bu = 'consorcio';

INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default) VALUES
  ('consorcio', 'group', 'b98e3746-d727-445b-b878-fc5742b6e6b8', true),
  ('consorcio', 'group', '267905ec-8fcf-4373-8d62-273bb6c6f8ca', false),
  ('consorcio', 'group', 'a6f3cbfc-0567-427f-a405-5a869aaa6010', false),
  ('consorcio', 'origin', '57013597-22f6-4969-848c-404b81dcc0cb', true),
  ('consorcio', 'origin', '4e2b810a-6782-4ce9-9c0d-10d04c018636', false);