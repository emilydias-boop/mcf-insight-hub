

## Plano: Corrigir Parcelas Falsamente Atrasadas (1.636 pagamentos ocultos)

### Diagnóstico

O problema é no filtro da função `sync-billing-from-hubla` na **linha 30**:

```
.gt("total_installments", 1)
```

Isso ignora completamente transações da Hubla onde `total_installments = 1`. Porém, a Hubla frequentemente reporta cada pagamento mensal como uma transação separada com `total_installments=1, installment_number=1` — em vez de reportar como "parcela X de Y".

Exemplo: Claudio Alberto tem 14 transações na Hubla para "Efeito Alavanca", mas 13 delas têm `total_installments=1`. Só a última (parcela 11/12) tem os dados corretos. O sync nunca enxergou as outras 12 transações.

**Impacto medido:**
- 1.636 pagamentos na Hubla ignorados pelo sync
- 931 assinaturas afetadas (parcelas marcadas "atrasado" quando na verdade foram pagas)
- ~1.042 installments poderiam ser corrigidos

### Solução (2 partes)

**Parte 1: Backfill SQL imediato** — Corrigir dados existentes

Para cada `billing_installment` com `status = 'atrasado'` e sem `hubla_transaction_id`:
1. Buscar `hubla_transactions` do mesmo `customer_email + product_name` com `total_installments = 1`
2. Ordenar ambos cronologicamente (installments por `data_vencimento`, transactions por `sale_date`)
3. Fazer match sequencial: parcela N ← N-ésima transação (não por data-proximity, que é impreciso)
4. Atualizar installment: `status = 'pago'`, `valor_pago = net_value`, `data_pagamento = sale_date`, `hubla_transaction_id`
5. Inserir registro em `billing_history` para cada correção
6. Recalcular `status` e `status_quitacao` das subscriptions afetadas

**Parte 2: Corrigir o sync** — Evitar que volte a acontecer

Alterar `sync-billing-from-hubla/index.ts` para também processar transações com `total_installments = 1` quando já existe uma `billing_subscription` para o mesmo `customer_email + product_name`. A lógica:
- Após processar as transações parceladas (total_installments > 1), buscar transações com `total_installments = 1` que correspondam a subscriptions existentes
- Ordenar por `sale_date` e match sequencial às parcelas não pagas

### Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/backfill_hidden_payments.sql` | Novo — SQL backfill dos 1.636 pagamentos ocultos |
| `supabase/functions/sync-billing-from-hubla/index.ts` | Alterar — incluir transações total_installments=1 no match |

### Resultado Esperado
- ~931 assinaturas corrigidas de "atrasada" para "em_dia" ou "quitada"
- KPIs de inadimplência reduzidos significativamente (de 1.261 atrasadas para ~330)
- Futuras transações individuais da Hubla serão capturadas automaticamente

