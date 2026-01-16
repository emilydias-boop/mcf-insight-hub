
-- Re-executar correção para parcelas intercaladas
-- Parcelas pares (2, 4, 6, 8) devem ser 'empresa' APENAS até o limite de parcelas_pagas_empresa
-- Se parcelas_pagas_empresa = 4: parcelas 2, 4, 6, 8 são empresa (pois 2/2=1, 4/2=2, 6/2=3, 8/2=4)
-- Parcela 10: 10/2=5 > 4, então é cliente

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
