

## Plano: Corrigir valor_pago e valor_total_contrato (fallback errado para bruto)

### Problema

A migration anterior tem dois bugs:

1. **valor_pago das parcelas 2+ com net_value=0**: O fallback `COALESCE(NULLIF(net_value, 0), product_price)` usa o `product_price` (bruto) quando `net_value=0`. Afeta **1.034 parcelas**. O correto é usar `net_value` diretamente (mesmo que 0).

2. **valor_total_contrato calculado com parcela 2**: A migration usou `parcela 2.valor_original` para calcular o contrato. Mas parcela 2 tem valor_original=0 (porque sua transação vinculada tem net_value=0). Resultado: **907 subscriptions** com valor_total_contrato = apenas o valor da parcela 1. O correto é usar o `net_value` da transação da parcela 1 como referência.

   Exemplo Almir: Total Contrato = R$ 600 (errado) → deveria ser 600 + 11×469.11 = **R$ 5.760,21**

### Correção

**SQL Migration** (dados existentes):

1. Corrigir `valor_pago` das 1.034 parcelas 2+ com fallback errado:
   - `valor_pago = ht.net_value` (sem fallback para product_price)

2. Recalcular `valor_total_contrato` usando o net_value da transação da **parcela 1** como referência (não da parcela 2):
   - `valor_total = p1.valor_original + (total_parcelas - 1) × net_value_da_transacao_p1`

3. Recalcular `status_quitacao` e `status`

**Sync function**: Corrigir o fallback de `valor_pago` no `sync-billing-from-hubla` para parcelas 2+ não cair em `product_price` quando `net_value=0`.

### Arquivos

| Arquivo | Ação |
|---------|------|
| SQL Migration | Fix 1.034 valor_pago + 907 valor_total_contrato + recalc status |
| `supabase/functions/sync-billing-from-hubla/index.ts` | Remover fallback product_price no valor_pago de parcelas 2+ |

