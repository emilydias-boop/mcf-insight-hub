
# Plano: Correção da Contabilização de Ligações no Kanban

## Problema Identificado

O contador de ligações mostra "0/5" mesmo quando existem ligações registradas. A investigação revelou:

1. **Estrutura dos dados está correta** - as ligações existem no banco com os `deal_id` corretos (UUID)
2. **Query SQL funciona** - testes diretos retornam os dados esperados
3. **Problema está na correspondência de IDs** - o hook `useBatchDealActivitySummary` usa IDs originais na query mas IDs normalizados como chave do Map

## Causa Raiz

No arquivo `src/hooks/useDealActivitySummary.ts`:

```typescript
// Linha 146: Query usa dealIds ORIGINAIS
.in('deal_id', dealIds)

// Mas o Map é indexado por IDs normalizados (linha 139)
summaryMap.set(normalizedId, { ...defaultSummary, maxAttempts });
```

Quando o Supabase retorna os dados de `calls`, o `deal_id` pode não corresponder exatamente à chave do Map devido a diferenças sutis de formatação.

---

## Alterações Necessárias

### 1. Corrigir Hook `useDealActivitySummary.ts`

Garantir que a query use os mesmos IDs que são usados como chave do Map:

**Alteração 1**: Usar o Map para lookup bidirecional (original -> normalizado)

```typescript
// Criar mapeamento reverso para lookup
const normalizedToOriginal = new Map<string, string>();
dealIds.forEach((id, index) => {
  normalizedToOriginal.set(normalizedDealIds[index], id);
});

// Na query, continuar usando dealIds originais (compatibilidade com UUID)
// Mas no lookup do resultado, normalizar SEMPRE
```

**Alteração 2**: No agregador de calls, garantir correspondência:

```typescript
calls?.forEach(call => {
  // Normalizar o ID retornado do Supabase
  const callDealId = call.deal_id?.toString().toLowerCase().trim();
  const summary = summaryMap.get(callDealId);
  
  if (summary) {
    summary.totalCalls++;
    // ... resto da lógica
  } else {
    console.warn('[useBatchDealActivitySummary] Call deal_id não encontrado no Map:', call.deal_id);
  }
});
```

**Alteração 3**: Adicionar log de debug temporário para diagnosticar:

```typescript
// DEBUG: verificar correspondência
console.log('[Batch] dealIds count:', dealIds.length);
console.log('[Batch] calls returned:', calls?.length);
console.log('[Batch] Map keys sample:', Array.from(summaryMap.keys()).slice(0, 3));
```

### 2. Verificar Tipo de Retorno do Supabase

O problema pode ser que `call.deal_id` é retornado como objeto UUID ao invés de string. Forçar conversão:

```typescript
const callDealId = String(call.deal_id || '').toLowerCase().trim();
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useDealActivitySummary.ts` | Forçar conversão de tipo e adicionar logs |

---

## Código Corrigido

```typescript
// Hook para buscar atividades de múltiplos deals de uma vez (otimização)
export function useBatchDealActivitySummary(dealIds: string[], stageIds?: Map<string, string>) {
  return useQuery({
    queryKey: ['batch-deal-activity-summary', dealIds.map(id => id.toLowerCase().trim()).sort().join(','), stageIds ? Array.from(stageIds.entries()).sort().join(',') : ''],
    queryFn: async (): Promise<Map<string, ActivitySummary>> => {
      const summaryMap = new Map<string, ActivitySummary>();
      
      if (dealIds.length === 0) return summaryMap;

      // Normalizar dealIds para garantir correspondência
      const normalizedDealIds = dealIds.map(id => String(id || '').toLowerCase().trim());

      // Buscar limites de tentativas por estágio
      const { data: stageLimits } = await supabase
        .from('stage_attempt_limits')
        .select('stage_id, max_attempts');
      
      const limitsMap = new Map<string, number>();
      stageLimits?.forEach(l => {
        if (l.stage_id) limitsMap.set(l.stage_id, l.max_attempts);
      });

      // Inicializar com valores padrão usando IDs normalizados
      normalizedDealIds.forEach((normalizedId, index) => {
        const originalId = dealIds[index];
        const stageId = stageIds?.get(originalId);
        const maxAttempts = stageId ? (limitsMap.get(stageId) ?? DEFAULT_MAX_ATTEMPTS) : DEFAULT_MAX_ATTEMPTS;
        summaryMap.set(normalizedId, { ...defaultSummary, maxAttempts });
      });

      // Buscar todas as ligações de uma vez (usar IDs originais para query UUID)
      const { data: calls, error: callsError } = await supabase
        .from('calls')
        .select('deal_id, status, outcome, created_at')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false });

      // DEBUG: Log para verificar
      if (callsError) {
        console.error('[useBatchDealActivitySummary] Error fetching calls:', callsError);
      }

      // ... resto das queries

      // Agregar por deal_id - FORÇAR conversão de tipo
      calls?.forEach(call => {
        // Converter para string e normalizar
        const callDealId = String(call.deal_id || '').toLowerCase().trim();
        const summary = summaryMap.get(callDealId);
        
        if (summary) {
          summary.totalCalls++;
          // ... resto da lógica
        }
      });

      // ... resto do código
    },
  });
}
```

---

## Resultado Esperado

1. Contador de ligações mostrará o número correto (ex: "30/5" para Ruberval)
2. Badge de prioridade de atividade funcionará corretamente
3. Logs ajudarão a diagnosticar se ainda houver problemas
