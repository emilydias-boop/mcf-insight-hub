-- Remove a CHECK constraint restritiva do campo origem
-- Isso permite que novas origens cadastradas em consorcio_origem_options funcionem automaticamente
ALTER TABLE consortium_cards 
DROP CONSTRAINT IF EXISTS consortium_cards_origem_check;