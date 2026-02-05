
# Plano: Ordenação por Coluna no Kanban

## Requisitos

1. **Ordenação padrão**: Mais recente para mais antigo (por `created_at DESC`)
2. **Ordenação por coluna**: Cada coluna do Kanban terá opções de ordenação individual

## Opções de Ordenação por Coluna

| Opção | Descrição | Critério |
|-------|-----------|----------|
| Mais Novo | Leads mais recentes primeiro | `created_at DESC` |
| Mais Antigo | Leads mais antigos primeiro | `created_at ASC` |
| + Atividades | Leads com mais atividades primeiro | `activitySummary.totalActivities DESC` |
| − Atividades | Leads com menos atividades primeiro | `activitySummary.totalActivities ASC` |
| + Tentativas | Leads com mais tentativas de contato | `activitySummary.totalCalls DESC` |
| − Tentativas | Leads com menos tentativas | `activitySummary.totalCalls ASC` |

## Alterações Técnicas

### 1. Novo Componente: `StageSortDropdown.tsx`

Dropdown compacto para o header de cada coluna com ícone de ordenação:

```text
┌─────────────────────────────────┐
│ Novo Lead          [↓] [1468]   │
│ ┌─────────────────────────────┐ │
│ │ ✓ Mais Novo                 │ │
│ │   Mais Antigo               │ │
│ │ ─────────────               │ │
│ │   + Atividades              │ │
│ │   − Atividades              │ │
│ │ ─────────────               │ │
│ │   + Tentativas              │ │
│ │   − Tentativas              │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 2. State de Ordenação por Estágio

Em `DealKanbanBoard.tsx`, adicionar state para controlar a ordenação de cada coluna:

```typescript
type SortOption = 'newest' | 'oldest' | 'most_activities' | 'least_activities' | 'most_calls' | 'least_calls';

const [stageSorts, setStageSorts] = useState<Record<string, SortOption>>({});

// Handler para mudar ordenação
const handleSortChange = (stageId: string, sort: SortOption) => {
  setStageSorts(prev => ({ ...prev, [stageId]: sort }));
};
```

### 3. Função de Ordenação

Criar função que ordena deals de acordo com a opção selecionada:

```typescript
const sortDeals = (deals: Deal[], sort: SortOption, activitySummaries: Map) => {
  return [...deals].sort((a, b) => {
    switch (sort) {
      case 'newest':
        return new Date(b.created_at) - new Date(a.created_at);
      case 'oldest':
        return new Date(a.created_at) - new Date(b.created_at);
      case 'most_activities':
        return (summaryB?.totalActivities || 0) - (summaryA?.totalActivities || 0);
      case 'least_activities':
        return (summaryA?.totalActivities || 0) - (summaryB?.totalActivities || 0);
      case 'most_calls':
        return (summaryB?.totalCalls || 0) - (summaryA?.totalCalls || 0);
      case 'least_calls':
        return (summaryA?.totalCalls || 0) - (summaryB?.totalCalls || 0);
      default:
        return 0;
    }
  });
};
```

### 4. Atualizar `dealsByStage` para Ordenar

O memo que agrupa deals por estágio aplicará a ordenação:

```typescript
const dealsByStage = useMemo(() => {
  const map: Record<string, typeof deals> = {};
  visibleStages.forEach((stage: any) => {
    const stageDeals = deals.filter(deal => 
      deal && deal.id && deal.name && deal.stage_id === stage.id
    );
    const sortOption = stageSorts[stage.id] || 'newest'; // Default: mais novo
    map[stage.id] = sortDeals(stageDeals, sortOption, activitySummaries);
  });
  return map;
}, [deals, visibleStages, stageSorts, activitySummaries]);
```

### 5. Integrar no Header da Coluna

Adicionar o dropdown de ordenação ao lado do badge de contagem:

```tsx
<CardHeader className={`flex-shrink-0 py-3 ${stage.color || 'bg-muted'}`}>
  <CardTitle className="text-sm font-medium">
    <div className="flex items-center justify-between">
      <span>{stage.stage_name}</span>
      <div className="flex items-center gap-1">
        <StageSortDropdown
          currentSort={stageSorts[stage.id] || 'newest'}
          onSortChange={(sort) => handleSortChange(stage.id, sort)}
        />
        <Badge variant="secondary">{stageDeals.length}</Badge>
      </div>
    </div>
    {/* ... StageSelectionControls ... */}
  </CardTitle>
</CardHeader>
```

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/crm/StageSortDropdown.tsx` | Criar | Componente dropdown de ordenação |
| `src/components/crm/DealKanbanBoard.tsx` | Modificar | Adicionar state e lógica de ordenação |
| `src/hooks/useCRMData.ts` | Verificar | Garantir ordenação padrão por `created_at DESC` |

## UI/UX

- **Ícone discreto**: Botão pequeno com ícone `ArrowUpDown` ou `SortDesc`
- **Indicador visual**: Ícone muda para refletir direção (↑ ou ↓)
- **Tooltip**: "Ordenar coluna" ao passar o mouse
- **Persistência**: Ordenação resetada ao recarregar (sem localStorage por simplicidade)
- **Default**: "Mais Novo" em todas as colunas

## Resultado Esperado

Cada coluna do Kanban terá seu próprio controle de ordenação, permitindo que o usuário:
- Veja leads mais antigos primeiro para priorizar atendimento
- Ordene por quantidade de atividades para identificar leads com pouca interação
- Ordene por tentativas para encontrar leads que precisam de mais follow-up
