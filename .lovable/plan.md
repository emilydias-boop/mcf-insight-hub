
## Problema

O loop de polling para corretamente quando `status === 'completed'`, mas:
1. `setIsImporting(false)` é chamado — OK
2. `clearInterval` é chamado — OK
3. **Porém `setProgress` não é atualizado para 100%** antes de parar

O resultado: a barra trava em 0% e a UI parece estar "Processando..." visualmente, mesmo que o job tenha terminado.

Também há um segundo problema: o texto "Processando..." do botão continua sendo exibido baseado em `isImporting`, que é setado para `false` corretamente — mas a barra de progresso permanece em 0%, dando a impressão de carregamento infinito.

## Correção

**Em `src/pages/crm/ImportarNegocios.tsx`**, no bloco do polling (linhas 229-238):

```typescript
// ANTES
if (job.status === 'completed' || job.status === 'failed') {
  setIsImporting(false);
  clearInterval(interval);
  ...
}

// DEPOIS  
if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
  setProgress(100);  // ← garantir que a barra chegue ao fim
  setIsImporting(false);
  clearInterval(interval);
  ...
}
```

Também corrigir o cálculo de progresso para usar `total_processed / total_deals` como fallback quando `current_chunk` não está disponível:

```typescript
const currentChunk = metadata?.current_chunk || 0;
const totalChunks = metadata?.total_chunks || 1;
// Se current_chunk não disponível, usar total_processed/total_deals
const processedDeals = job.total_processed || 0;
const totalDeals = metadata?.total_deals || 1;
const progressPercent = totalChunks > 1 
  ? Math.round((currentChunk / totalChunks) * 100)
  : Math.round((processedDeals / totalDeals) * 100);
```

## Arquivo a modificar
- `src/pages/crm/ImportarNegocios.tsx` — bloco de polling (linhas ~229-238) e cálculo de progresso (~223-227)
