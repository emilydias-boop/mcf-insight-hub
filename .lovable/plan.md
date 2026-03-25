

## Corrigir Filtros do Controle Diego

### Problema
O filtro de **Pipeline** (originId) nunca é aplicado -- está definido no `ContractReportFilters` mas nunca é usado na query do Supabase. O `crm_deals` não usa `!inner` join, então filtrar via PostgREST nessa relação não exclui rows do pai.

### Solução
Aplicar o filtro de `originId` **client-side** no `ControleDiegoPanel.tsx`, já que `crm_deals` não é inner join. Também adicionar `originId` ao `ContractReportRow` e `KanbanRow` para permitir a filtragem.

### Alterações

#### 1. `src/hooks/useContractReport.ts`
- Adicionar `originId: string | null` ao `ContractReportRow`
- No mapeamento (linha ~235), incluir: `originId: origin?.id || null`

#### 2. `src/components/relatorios/ControleDiegoPanel.tsx`
- Adicionar `originId: string | null` ao `KanbanRow`
- Mapear `originId: row.originId` na transformação dos dados
- Remover `originId` do objeto `filters` passado ao hook (não é usado server-side)
- Adicionar filtro client-side no `rows` useMemo:
  ```typescript
  if (selectedOriginId !== 'all') {
    filtered = filtered.filter(r => r.originId === selectedOriginId);
  }
  ```
- Adicionar `selectedOriginId` ao array de dependências do `rows` useMemo

### Arquivos modificados
- `src/hooks/useContractReport.ts` -- adicionar `originId` ao row
- `src/components/relatorios/ControleDiegoPanel.tsx` -- aplicar filtro de origin client-side e corrigir deps do useMemo

