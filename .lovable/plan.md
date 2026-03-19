

## Plano: Corrigir calculo de status de quitacao no sync

### Problema
O sync calcula `paidCount = txList.length` (total de transacoes na Hubla) e compara com `totalInstallments`. Quando existem transacoes duplicadas para o mesmo `installment_number` (ex: Marcio tem 2 transacoes ambas com `installment_number=1`), o sistema conta como 2 parcelas pagas e marca como "quitada" incorretamente. Isso afeta potencialmente muitas assinaturas.

### Causa raiz
Linha 123-131 do `sync-billing-from-hubla/index.ts`:
```
const paidCount = txList.length;  // ERRADO: conta transacoes, nao parcelas distintas
if (paidCount >= totalInstallments) {
  status = "quitada";
```

### Solucao

**Arquivo: `supabase/functions/sync-billing-from-hubla/index.ts`**

Trocar `paidCount = txList.length` por contar **parcelas distintas pagas** usando `installment_number`:

```typescript
// Contar parcelas DISTINTAS pagas (pelo installment_number)
const distinctPaidNumbers = new Set(txList.map(tx => tx.installment_number || 1));
const paidCount = distinctPaidNumbers.size;
```

Isso garante que 2 transacoes com `installment_number=1` contam como 1 parcela paga, nao 2.

### Apos deploy

Rodar "Sincronizar Hubla" para recalcular os status de todas as assinaturas que foram incorretamente marcadas como quitadas.

### Arquivo afetado

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/sync-billing-from-hubla/index.ts` | Trocar `txList.length` por contagem de `installment_number` distintos (1 linha) |

