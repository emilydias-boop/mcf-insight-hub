
-- Corrigir tipo das parcelas para contratos intercalados existentes
-- Parcelas pares (2, 4, 6, 8...) devem ser 'empresa' até o limite de parcelas_pagas_empresa
-- Exemplo: Se parcelas_pagas_empresa = 4, então parcelas 2, 4, 6, 8 são 'empresa'

UPDATE consortium_installments ci
SET tipo = CASE
  WHEN ci.numero_parcela % 2 = 0 
       AND (ci.numero_parcela / 2) <= cc.parcelas_pagas_empresa 
  THEN 'empresa'
  ELSE 'cliente'
END
FROM consortium_cards cc
WHERE ci.card_id = cc.id
  AND cc.tipo_contrato = 'intercalado';
