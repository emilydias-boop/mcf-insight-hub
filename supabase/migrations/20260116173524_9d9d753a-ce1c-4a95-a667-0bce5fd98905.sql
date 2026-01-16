-- Adicionar campos de contemplação na tabela consortium_cards
ALTER TABLE consortium_cards ADD COLUMN IF NOT EXISTS numero_contemplacao VARCHAR(20);
ALTER TABLE consortium_cards ADD COLUMN IF NOT EXISTS data_contemplacao DATE;
ALTER TABLE consortium_cards ADD COLUMN IF NOT EXISTS motivo_contemplacao VARCHAR(50);
ALTER TABLE consortium_cards ADD COLUMN IF NOT EXISTS valor_lance DECIMAL(15,2);
ALTER TABLE consortium_cards ADD COLUMN IF NOT EXISTS percentual_lance DECIMAL(5,2);

-- Comentários explicativos
COMMENT ON COLUMN consortium_cards.numero_contemplacao IS 'Número sorteado da loteria federal que contemplou a cota';
COMMENT ON COLUMN consortium_cards.data_contemplacao IS 'Data em que a cota foi contemplada';
COMMENT ON COLUMN consortium_cards.motivo_contemplacao IS 'Tipo de contemplação: sorteio, lance, lance_fixo';
COMMENT ON COLUMN consortium_cards.valor_lance IS 'Valor do lance dado para contemplação';
COMMENT ON COLUMN consortium_cards.percentual_lance IS 'Percentual do crédito dado como lance';