

## Plano: Corrigir valor_pago = 0 nas parcelas do backfill

### Causa Raiz

A migration de backfill usou `COALESCE(tx_net_value, tx_product_price, valor_original)`. Porém, 1.067 transações Hubla têm `net_value = 0` (zero, não NULL). O COALESCE retorna 0 porque 0 não é NULL — ignorando o `product_price` que tem o valor real.

Exemplo do Guilherme: parcela #2 linkada à transação `e8160659` que tem `net_value=0, product_price=?`. Resultado: `valor_pago = 0`.

### Correção

**Migration SQL** para corrigir as 1.067 parcelas afetadas:

1. Para cada `billing_installment` com `status = 'pago'` e `valor_pago = 0` que tenha `hubla_transaction_id`:
   - Buscar o `product_price` da `hubla_transaction` vinculada
   - Atualizar `valor_pago = COALESCE(NULLIF(ht.net_value, 0), ht.product_price, bi.valor_original)`
2. Recalcular `status_quitacao` e totais das subscriptions afetadas

### Resultado
- 1.067 parcelas terão o valor correto (ex: Guilherme parcela #2 mostrará o valor real em vez de "-")
- KPIs de "Total Pago" e "Saldo Devedor" serão recalculados corretamente

