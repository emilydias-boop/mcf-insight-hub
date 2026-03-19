

## Plano: Corrigir regra de valor_pago (bruto na 1a, líquido nas demais)

### Problema

A lógica anterior tratou todas as parcelas igualmente com `COALESCE(NULLIF(net_value, 0), product_price, ...)`. Na Hubla, a primeira parcela sempre reporta o valor bruto (`product_price`) e as demais o líquido (`net_value`). Resultado: 1.645 primeiras parcelas estão com valor errado.

### Correção (2 partes)

**Parte 1: Migration SQL** — Corrigir dados existentes

```sql
UPDATE billing_installments bi
SET valor_pago = CASE 
    WHEN bi.numero_parcela = 1 THEN COALESCE(NULLIF(ht.product_price, 0), bi.valor_original)
    ELSE COALESCE(NULLIF(ht.net_value, 0), ht.product_price, bi.valor_original)
  END
FROM hubla_transactions ht
WHERE bi.hubla_transaction_id = ht.id AND bi.status = 'pago';
```

Seguido de recalcular `status_quitacao` das subscriptions afetadas.

**Parte 2: Sync function** — Aplicar mesma regra no `sync-billing-from-hubla`

Alterar todas as linhas que calculam `valor_pago` para usar:
- `product_price` quando `installment_number = 1`
- `net_value` quando `installment_number > 1`

### Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL (via ferramenta) | Corrigir 1.645 parcelas + recalcular subscriptions |
| `supabase/functions/sync-billing-from-hubla/index.ts` | Alterar lógica de valor_pago para respeitar a regra bruto/líquido |

### Resultado
- Parcela 1 mostrará o valor bruto correto
- Parcelas 2+ mostrarão o valor líquido correto
- KPIs recalculados com valores reais

