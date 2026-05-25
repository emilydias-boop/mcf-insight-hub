UPDATE consortium_installments ci
SET valor_comissao = 0
FROM consortium_cards cc
WHERE ci.card_id = cc.id
  AND (
    (cc.tipo_produto = 'select'     AND ci.numero_parcela > 8)
    OR
    (cc.tipo_produto = 'parcelinha' AND ci.numero_parcela > 12)
  )
  AND ci.valor_comissao <> 0;