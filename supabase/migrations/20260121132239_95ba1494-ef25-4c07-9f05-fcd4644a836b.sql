-- Adiciona coluna para override manual do valor bruto
ALTER TABLE hubla_transactions 
ADD COLUMN gross_override numeric DEFAULT NULL;

COMMENT ON COLUMN hubla_transactions.gross_override IS 
  'Valor bruto manual que sobrepõe o cálculo automático. NULL = usar cálculo padrão.';