
# Plano: Corrigir Classificação A010 - Limitar Requisições Paralelas

## Problema Raiz

Os logs mostram erros **"Failed to fetch"** nos chunks 19-23+:

```
[useBulkA010Check] Erro no chunk 19: TypeError: Failed to fetch
[useBulkA010Check] Erro no chunk 20: TypeError: Failed to fetch
...
```

**Causa**: Com ~5.000 emails divididos em chunks de 200 (~25 chunks), todas as requisições são feitas em paralelo via `Promise.allSettled`. Navegadores têm **limite de 6-8 conexões simultâneas por domínio**. Quando esse limite é excedido, requisições falham com "Failed to fetch".

**Efeito**: Emails nos chunks que falharam são marcados como `false` (não A010), exibindo incorretamente o badge "LIVE".

---

## Solução

Implementar **controle de concorrência** para limitar o número de requisições paralelas (máximo 5 de cada vez), usando uma função `processInBatches` que aguarda a conclusão de um lote antes de iniciar o próximo.

### Mudanças no Hook

**Arquivo**: `src/hooks/useBulkA010Check.ts`

| Antes | Depois |
|-------|--------|
| `Promise.allSettled(chunks.map(...))` | Processar em lotes de 5 chunks por vez |
| Todas requisições simultâneas | Aguardar cada lote terminar antes do próximo |
| Falhas por limite de conexão | Requisições controladas, sem falhas |

---

## Detalhes Técnicos

### Função de Controle de Concorrência

```typescript
async function processInBatches<T>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<any>
): Promise<PromiseSettledResult<any>[]> {
  const results: PromiseSettledResult<any>[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => processor(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}
```

### Uso no Hook

```typescript
// Processar no máximo 5 chunks por vez (5 x 200 = 1000 emails por lote)
const MAX_CONCURRENT_REQUESTS = 5;

const results = await processInBatches(
  emailChunks,
  MAX_CONCURRENT_REQUESTS,
  (chunk) => supabase
    .from('hubla_transactions')
    .select('customer_email')
    .eq('product_category', 'a010')
    .eq('sale_status', 'completed')
    .in('customer_email', chunk)
);
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useBulkA010Check.ts` | Adicionar `processInBatches` e aplicar nos hooks |

---

## Resultado Esperado

- Requisições controladas em lotes de 5 (dentro do limite do navegador)
- Zero erros "Failed to fetch"
- Todos os emails A010 corretamente identificados com badge azul
- Leads BIO com badge verde
- Leads LIVE com badge roxo
