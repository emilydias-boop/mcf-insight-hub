
# Plano: Sistema de Rastreamento de Atividades por SDR (Corrigido)

## Contexto

O sistema já possui:
- `stage_moved_at` em `crm_deals` - atualizado ao arrastar lead
- `deal_activities` - registra atividades como ligações, notas, mudanças de estágio
- `calls` - registra ligações separadamente

**Problema**: Lead do ano passado trabalhado hoje deve contar nas métricas do dia atual, considerando TANTO atividades QUANTO arrastamento de estágio.

---

## Solução Corrigida

### Lógica de Contabilização

```text
last_worked_at = MAX(
  stage_moved_at,           // Quando arrastou para outro estágio
  última deal_activities,   // Quando fez nota, ligação via sistema
  última calls              // Quando ligou via Twilio
)
```

Assim, se o SDR:
1. Faz ligação → registra atividade → `last_worked_at` atualiza
2. Depois arrasta → `stage_moved_at` atualiza → `last_worked_at` usa o maior valor
3. Lead é contabilizado NO ESTÁGIO ATUAL com data de trabalho correta

---

## Alterações Necessárias

### 1. Migração: Campo `last_worked_at` + Trigger Combinado

Criar campo que atualiza automaticamente quando houver atividade OU mudança de estágio:

```sql
-- Adicionar campo
ALTER TABLE crm_deals ADD COLUMN last_worked_at TIMESTAMPTZ;

-- Inicializar com MAIOR entre stage_moved_at e created_at
UPDATE crm_deals SET last_worked_at = COALESCE(
  GREATEST(stage_moved_at, created_at),
  created_at
);

-- Trigger para deal_activities
CREATE OR REPLACE FUNCTION update_deal_last_worked_from_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE crm_deals 
  SET last_worked_at = GREATEST(
    COALESCE(last_worked_at, '1970-01-01'),
    NEW.created_at
  )
  WHERE clint_id = NEW.deal_id OR id::text = NEW.deal_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deal_activity_last_worked
AFTER INSERT ON deal_activities
FOR EACH ROW EXECUTE FUNCTION update_deal_last_worked_from_activity();

-- Trigger para calls
CREATE OR REPLACE FUNCTION update_deal_last_worked_from_call()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE crm_deals 
  SET last_worked_at = GREATEST(
    COALESCE(last_worked_at, '1970-01-01'),
    NEW.created_at
  )
  WHERE id = NEW.deal_id::uuid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_call_last_worked
AFTER INSERT ON calls
FOR EACH ROW EXECUTE FUNCTION update_deal_last_worked_from_call();
```

### 2. Atualizar `useUpdateCRMDeal` para Sincronizar `last_worked_at`

**Arquivo:** `src/hooks/useCRMData.ts`

Quando `stage_moved_at` atualiza, também atualizar `last_worked_at`:

```typescript
// Linha ~579 - Após atualizar stage_moved_at
if (deal.stage_id && previousStageId !== deal.stage_id) {
  const now = new Date().toISOString();
  deal.stage_moved_at = now;
  deal.last_worked_at = now; // NOVO: sincronizar
}
```

### 3. Criar Hook: `src/hooks/useSdrActivityMetrics.ts`

Hook para métricas de atividades por SDR no período:

```typescript
export interface SdrActivityMetrics {
  sdrEmail: string;
  sdrName: string;
  
  // Atividades do período
  totalCalls: number;
  answeredCalls: number;
  notesAdded: number;
  stageChanges: number;
  
  // Leads trabalhados
  uniqueLeadsWorked: number;
  
  // Calculado
  avgCallsPerLead: number;
}

export function useSdrActivityMetrics(
  startDate: Date,
  endDate: Date,
  originId?: string
) {
  return useQuery({
    queryKey: ['sdr-activity-metrics', startDate, endDate, originId],
    queryFn: async (): Promise<SdrActivityMetrics[]> => {
      // 1. Buscar ligações por user_id no período
      // 2. Buscar deal_activities por user_id no período
      // 3. Agrupar por user_id (SDR) usando SDR_LIST
      // 4. Calcular unique leads via deal_id
    },
  });
}
```

### 4. Adicionar Filtro "Prioridade de Trabalho" no Kanban

**Arquivo:** `src/components/crm/DealFilters.tsx`

Adicionar novo campo à interface e novo select:

```typescript
// Interface
export interface DealFiltersState {
  // ... campos existentes
  activityPriority: 'all' | 'high' | 'medium' | 'low' | null;
}

// Lógica:
// high (🔴): 0 atividades - nunca foi trabalhado
// medium (🟡): 1-3 atividades - pouco trabalhado
// low (🟢): 4+ atividades - bastante trabalhado
```

Adicionar select no componente:

```typescript
<Select
  value={filters.activityPriority || 'all'}
  onValueChange={(value) => onChange({ 
    ...filters, 
    activityPriority: value === 'all' ? null : value 
  })}
>
  <SelectTrigger className="w-[160px]">
    <div className="flex items-center gap-2">
      <Activity className="h-4 w-4" />
      <SelectValue placeholder="Prioridade" />
    </div>
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Qualquer</SelectItem>
    <SelectItem value="high">
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Alta (0 ativ.)
      </span>
    </SelectItem>
    <SelectItem value="medium">
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
        Média (1-3 ativ.)
      </span>
    </SelectItem>
    <SelectItem value="low">
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Baixa (4+ ativ.)
      </span>
    </SelectItem>
  </SelectContent>
</Select>
```

### 5. Atualizar `useBatchDealActivitySummary` para Incluir Total de Atividades

**Arquivo:** `src/hooks/useDealActivitySummary.ts`

Adicionar campo `totalActivities` que soma todas as interações:

```typescript
export interface ActivitySummary {
  // ... campos existentes
  totalActivities: number; // NOVO: calls + notes + whatsapp + stage_changes
}

// Na queryFn, calcular:
summary.totalActivities = summary.totalCalls + summary.whatsappSent + notesCount;
```

### 6. Adicionar Badge de Prioridade no Card do Kanban

**Arquivo:** `src/components/crm/DealKanbanCard.tsx`

Exibir badge colorido baseado no total de atividades:

```typescript
// Função helper
const getActivityPriorityBadge = (totalActivities: number) => {
  if (totalActivities === 0) {
    return { color: 'bg-red-500', label: '0', tooltip: 'Alta prioridade - sem atividades' };
  }
  if (totalActivities <= 3) {
    return { color: 'bg-yellow-500', label: totalActivities.toString(), tooltip: 'Média prioridade' };
  }
  return { color: 'bg-green-500', label: totalActivities.toString(), tooltip: 'Baixa prioridade' };
};

// No JSX, próximo ao badge de canal:
{activitySummary && (
  <Badge 
    variant="outline"
    className={`text-[10px] px-1 py-0 ${priorityBadge.color} text-white`}
  >
    {priorityBadge.label}
  </Badge>
)}
```

### 7. Criar Seção de KPIs de Atividades em ReunioesEquipe

**Arquivo:** `src/pages/crm/ReunioesEquipe.tsx`

Adicionar tabela de atividades por SDR:

| SDR | Ligações | Atendidas | Notas | Movimentações | Leads Trabalhados |
|-----|----------|-----------|-------|---------------|-------------------|
| Ana | 45 | 12 | 8 | 30 | 35 |
| Carlos | 38 | 15 | 5 | 25 | 30 |

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Database | Migration | Campo `last_worked_at` + triggers |
| `src/hooks/useCRMData.ts` | Modificar | Sincronizar `last_worked_at` ao arrastar |
| `src/hooks/useSdrActivityMetrics.ts` | Criar | Hook de métricas de atividade |
| `src/components/crm/DealFilters.tsx` | Modificar | Filtro de prioridade de atividade |
| `src/hooks/useDealActivitySummary.ts` | Modificar | Campo `totalActivities` |
| `src/components/crm/DealKanbanCard.tsx` | Modificar | Badge de prioridade |
| `src/pages/crm/ReunioesEquipe.tsx` | Modificar | Seção de KPIs de atividades |

---

## Fluxo Corrigido

```text
SDR trabalha lead antigo (2025)
    |
    +-- Faz ligação → deal_activities INSERT → trigger atualiza last_worked_at
    |
    +-- Arrasta para outro estágio → stage_moved_at E last_worked_at atualizam
    |
    V
Lead contabilizado:
  - NO ESTÁGIO ATUAL (stage_id correto)
  - COM DATA DE TRABALHO = HOJE (last_worked_at)
  - NAS MÉTRICAS DO SDR DO DIA ATUAL
```

---

## Resultado Esperado

1. **Contabilização correta**: Lead arrastado conta no estágio de destino, não no anterior
2. **Data de trabalho precisa**: Usa o MAIOR entre arrastamento e última atividade
3. **Filtro de priorização**: SDRs focam em leads com menos atividades (🔴 primeiro)
4. **Badge visual**: Identifica rapidamente leads negligenciados
5. **Relatório de KPIs**: Gestores acompanham produtividade de cada SDR
