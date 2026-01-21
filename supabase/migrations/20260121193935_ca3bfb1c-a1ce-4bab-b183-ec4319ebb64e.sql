-- Add carrinho fields to meeting_slot_attendees
ALTER TABLE meeting_slot_attendees 
ADD COLUMN IF NOT EXISTS carrinho_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS carrinho_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN meeting_slot_attendees.carrinho_status IS 'Status do carrinho: vai_comprar, comprou, nao_comprou';
COMMENT ON COLUMN meeting_slot_attendees.carrinho_updated_at IS 'Data da última atualização do status do carrinho';