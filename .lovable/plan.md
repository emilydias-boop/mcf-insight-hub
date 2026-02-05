
# Plano: Correção da Contabilização de Ligações no Kanban

## Problema Identificado

O contador de ligações no card do Kanban mostra "0/5" mesmo quando existem ligações registradas na tabela `calls`. A investigação revelou que:

1. As ligações existem corretamente no banco de dados
2. A query individual funciona (retorna 2 ligações para o deal `822c7356`)
3. O problema está na query batch ou na forma como o Map é acessado

## Causa Raiz

O hook `useBatchDealActivitySummary` inicializa o Map com os dealIds e depois tenta fazer `summaryMap.get(call.deal_id)`. Se houver qualquer diferença de formato entre as strings (mesmo espaços ou case), a busca falha silenciosamente.

---

## Alterações Necessárias

### 1. Adicionar logs de debug temporários

**Arquivo:** `src/hooks/useDealActivitySummary.ts`

```typescript
// Linha ~134 - Após buscar calls
const { data: calls } = await supabase
  .from('calls')
  .select('deal_id, status, outcome, created_at')
  .in('deal_id', dealIds)
  .order('created_at', { ascending: false });

// DEBUG: Log para verificar
console.log('[useBatchDealActivitySummary] dealIds count:', dealIds.length);
console.log('[useBatchDealActivitySummary] calls returned:', calls?.length);
```

### 2. Garantir correspondência exata dos IDs

**Arquivo:** `src/hooks/useDealActivitySummary.ts`

Normalizar os IDs para garantir correspondência:

```typescript
// Linha ~127-132 - Inicialização do Map
// Normalizar dealIds para lowercase e trim
const normalizedDealIds = dealIds.map(id => id.toLowerCase().trim());

normalizedDealIds.forEach((id, index) => {
  const originalId = dealIds[index];
  const stageId = stageIds?.get(originalId);
  const maxAttempts = stageId ? (limitsMap.get(stageId) ?? DEFAULT_MAX_ATTEMPTS) : DEFAULT_MAX_ATTEMPTS;
  summaryMap.set(id, { ...defaultSummary, maxAttempts });
});

// Linha ~155-175 - Agregação
calls?.forEach(call => {
  const normalizedCallDealId = call.deal_id?.toLowerCase().trim();
  const summary = summaryMap.get(normalizedCallDealId);
  // ...
});
```

### 3. Corrigir acesso ao Map no componente

**Arquivo:** `src/components/crm/DealKanbanBoardInfinite.tsx`

```typescript
// Linha 261 - Garantir que o ID está normalizado
activitySummary={activitySummaries?.get(deal.id.toLowerCase().trim())}
```

### 4. Aumentar robustez com fallback

**Arquivo:** `src/hooks/useDealActivitySummary.ts`

Se o Map não encontrar, buscar pelo ID original também:

```typescript
calls?.forEach(call => {
  // Tentar normalizado primeiro
  let summary = summaryMap.get(call.deal_id?.toLowerCase().trim());
  
  // Fallback: tentar ID original
  if (!summary) {
    summary = summaryMap.get(call.deal_id);
  }
  
  if (summary) {
    summary.totalCalls++;
    // ...
  }
});
```

---

## Fluxo Corrigido

```text
dealIds do Kanban: ['ABC-123', 'DEF-456']
         |
         V
Normaliza para Map: ['abc-123', 'def-456']
         |
         V
Query calls retorna: [{ deal_id: 'abc-123' }, ...]
         |
         V
summaryMap.get('abc-123') ✓ Encontra!
         |
         V
totalCalls++ → Exibe 2/5 no card
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useDealActivitySummary.ts` | Normalizar IDs e adicionar fallback |
| `src/components/crm/DealKanbanBoardInfinite.tsx` | Normalizar ID ao acessar Map |
| `src/components/crm/DealKanbanBoard.tsx` | Normalizar ID ao acessar Map |

---

## Resultado Esperado

1. Contador de ligações mostrará o número correto (ex: "2/5")
2. Badge de prioridade de atividade funcionará corretamente
3. Filtro de prioridade no Kanban funcionará como esperado
