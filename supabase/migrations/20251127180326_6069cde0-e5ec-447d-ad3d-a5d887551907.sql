-- Habilitar Realtime na tabela hubla_transactions
ALTER TABLE hubla_transactions REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE hubla_transactions;