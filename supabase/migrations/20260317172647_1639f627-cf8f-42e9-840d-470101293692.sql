UPDATE webhook_endpoints 
SET field_mapping = field_mapping || '{"nome_completo": "name", "telefone": "phone"}'::jsonb 
WHERE slug = 'clientdata-inside';