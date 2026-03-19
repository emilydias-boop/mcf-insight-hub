

## Plano: Corrigir sincronização para atualizar parcelas existentes

### Problema
O `sync-billing-from-hubla` cria parcelas corretamente na primeira execução, mas ao rodar novamente **pula parcelas que já existem** — mesmo que tenham sido pagas na Hubla desde então. Resultado: 274 assinaturas com 280 parcelas pagas na Hubla que continuam como "atrasado" ou "pendente" no billing.

### Causa raiz
Linha 264 do sync: `if (existingNums.has(i)) continue;` — se a parcela já existe no billing, ignora. Nunca atualiza status de parcelas existentes com dados novos da Hubla.

### Solução

**Arquivo: `supabase/functions/sync-billing-from-hubla/index.ts`**

1. Ao buscar parcelas existentes (linha 220), trazer também o `status` atual além de `subscription_id, numero_parcela`
2. No loop de parcelas (linha 263), quando a parcela já existe E está como `pendente`/`atrasado`, mas na Hubla tem um pagamento (`paidMap[i]` existe): **atualizar** a parcela para `pago` com `valor_pago`, `data_pagamento` e `hubla_transaction_id`
3. Acumular essas atualizações e executar em batch

Mudança mínima — apenas ~20 linhas adicionadas no bloco que hoje faz `continue`.

```text
Antes:
  if (existingNums.has(i)) continue;  // pula sempre

Depois:
  if (existingNums.has(i)) {
    // Se parcela existe mas não está paga, e Hubla mostra pagamento → atualizar
    if (paid && existingStatus !== 'pago') {
      installmentsToUpdate.push({ subId, numero: i, paid });
    }
    continue;
  }
```

Isso corrige as 280 parcelas na próxima sincronização e garante que futuras execuções do sync sempre atualizem parcelas que foram pagas.

