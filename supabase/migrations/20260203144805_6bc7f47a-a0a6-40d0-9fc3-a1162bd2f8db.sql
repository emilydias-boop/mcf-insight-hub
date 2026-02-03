-- Add observacao column to consortium_installments table
ALTER TABLE consortium_installments ADD COLUMN IF NOT EXISTS observacao TEXT;

-- Fix existing intercalado cards: recalculate tipo based on correct logic
-- For intercalado contracts, empresa pays only the first N EVEN installments
UPDATE consortium_installments ci
SET tipo = CASE 
  WHEN (ci.numero_parcela % 2 = 0) AND (ci.numero_parcela / 2 <= cc.parcelas_pagas_empresa) 
  THEN 'empresa' 
  ELSE 'cliente' 
END
FROM consortium_cards cc
WHERE ci.card_id = cc.id
  AND cc.tipo_contrato = 'intercalado';