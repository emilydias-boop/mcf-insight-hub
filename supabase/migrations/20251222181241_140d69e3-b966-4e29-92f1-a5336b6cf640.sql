-- Criar índice único para permitir upsert por instance_id
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_instances_instance_id_key 
ON whatsapp_instances (instance_id);