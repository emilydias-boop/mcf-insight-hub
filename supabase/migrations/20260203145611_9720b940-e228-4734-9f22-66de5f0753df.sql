-- Drop existing constraint and add new one with intercalado_impar option
ALTER TABLE consortium_cards 
DROP CONSTRAINT IF EXISTS consortium_cards_tipo_contrato_check;

ALTER TABLE consortium_cards 
ADD CONSTRAINT consortium_cards_tipo_contrato_check 
CHECK (tipo_contrato IN ('normal', 'intercalado', 'intercalado_impar'));