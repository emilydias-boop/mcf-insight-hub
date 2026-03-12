

## Diagnóstico: KPI "AGENDAMENTOS" mostra R1 Agendada em vez de Agendamentos

**O problema está na linha 283 de `ReunioesEquipe.tsx`:**

```typescript
totalAgendamentos: r1FromClosers.r1Agendada,  // ← ERRADO
```

O `enrichedKPIs` sobrescreve `totalAgendamentos` (que vem correto do `teamKPIs` — soma dos `agendamentos` por SDR baseados em `created_at`) com `r1FromClosers.r1Agendada` (reuniões agendadas PARA o período, baseadas em `scheduled_at`).

Ou seja, o card "AGENDAMENTOS" mostra o mesmo valor de "R1 Agendada", quando deveria mostrar o total de agendamentos criados no período.

**Contexto dos dados:**
- `teamKPIs.totalAgendamentos` = soma de `bySDR[].agendamentos` = contagem por `created_at` (correto)
- `r1FromClosers.r1Agendada` = contagem por `scheduled_at` (é o que deve aparecer em "R1 Agendada", não em "Agendamentos")

### Correção

**Arquivo: `src/pages/crm/ReunioesEquipe.tsx` (linha 283)**

Remover a sobrescrita de `totalAgendamentos`:

```typescript
// ANTES:
totalAgendamentos: r1FromClosers.r1Agendada,

// DEPOIS:
// não sobrescrever — manter o valor original de teamKPIs.totalAgendamentos
```

O `enrichedKPIs` ficará:
```typescript
const enrichedKPIs = useMemo(() => ({
  ...teamKPIs,
  // totalAgendamentos vem do spread de teamKPIs (correto, por created_at)
  totalR1Agendada: r1FromClosers.r1Agendada,
  totalRealizadas: r1FromClosers.r1Realizada,
  totalNoShows: r1FromClosers.noShows,
  totalContratos: contractsFromClosers.total,
  totalOutside: contractsFromClosers.outside,
  taxaNoShow: ...,
  taxaConversao: ...,
}), [teamKPIs, contractsFromClosers, r1FromClosers]);
```

Isso faz com que:
- **Card "AGENDAMENTOS"** → `teamKPIs.totalAgendamentos` (created_at, esforço do SDR no dia)
- **Coluna "R1 Agendada"** na tabela → `r1Agendada` (scheduled_at, reuniões marcadas para o período)

Mesma correção aplica-se aos memos `dayValues`, `weekValues`, `monthValues` que já leem `totalAgendamentos` — automaticamente corrigidos ao remover a sobrescrita.

