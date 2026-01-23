-- Adicionar coluna para vinculação manual de transações a leads aprovados
ALTER TABLE hubla_transactions 
ADD COLUMN linked_attendee_id UUID REFERENCES meeting_slot_attendees(id);

-- Criar índice para melhor performance nas buscas
CREATE INDEX idx_hubla_transactions_linked_attendee 
ON hubla_transactions(linked_attendee_id) 
WHERE linked_attendee_id IS NOT NULL;

COMMENT ON COLUMN hubla_transactions.linked_attendee_id IS 
  'Vinculação manual a um lead aprovado do R2 (usado quando match automático por email/telefone não funciona)';