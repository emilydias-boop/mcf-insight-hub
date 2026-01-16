-- Adicionar novos campos de controle na tabela consortium_cards
ALTER TABLE consortium_cards ADD COLUMN IF NOT EXISTS valor_comissao DECIMAL(15,2);
ALTER TABLE consortium_cards ADD COLUMN IF NOT EXISTS e_transferencia BOOLEAN DEFAULT false;
ALTER TABLE consortium_cards ADD COLUMN IF NOT EXISTS transferido_de VARCHAR(255);
ALTER TABLE consortium_cards ADD COLUMN IF NOT EXISTS observacoes TEXT;