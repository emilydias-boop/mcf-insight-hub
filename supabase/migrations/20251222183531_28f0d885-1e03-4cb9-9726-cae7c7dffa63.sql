-- Adicionar coluna is_group na tabela whatsapp_conversations
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;

-- Atualizar conversas de grupo existentes baseado no remote_jid
UPDATE whatsapp_conversations 
SET is_group = TRUE 
WHERE remote_jid LIKE '%@g.us' OR remote_jid LIKE '%-group@c.us';