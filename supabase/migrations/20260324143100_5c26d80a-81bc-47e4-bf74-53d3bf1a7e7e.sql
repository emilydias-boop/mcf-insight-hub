UPDATE webhook_endpoints
SET field_mapping = field_mapping || '{"nomeCompleto": "name"}'::jsonb
WHERE slug = 'anamnese-insta-mcf';