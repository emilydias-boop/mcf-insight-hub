
# Plano: Adicionar Filtro de Closer R1 nas Abas Pendentes e No-Shows

## Objetivo

Adicionar filtro por Closer R1 nas abas "Pendentes" e "No-Shows" da Agenda R2, permitindo ver apenas leads que passaram pela R1 de um closer especifico.

---

## Alteracoes

### 1. Aba Pendentes (`src/components/crm/R2PendingLeadsPanel.tsx`)

Os dados do Closer R1 ja estao disponiveis (`meeting_slot.closer`), so precisamos adicionar o filtro na UI.

**Alteracoes:**

```typescript
// Adicionar imports
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Adicionar estado
const [r1CloserFilter, setR1CloserFilter] = useState<string>('all');

// Buscar closers R1
const { data: r1Closers = [] } = useGestorClosers('r1');

// Filtrar leads
const filteredLeads = useMemo(() => {
  if (r1CloserFilter === 'all') return pendingLeads;
  return pendingLeads.filter(lead => lead.meeting_slot?.closer?.id === r1CloserFilter);
}, [pendingLeads, r1CloserFilter]);
```

**UI - Adicionar dropdown no header:**
```text
+------------------------------------------+
| 43 pendentes  Leads aguardando R2        |
|                                          |
| [Closer R1: Todos ▼]                     |
+------------------------------------------+
```

---

### 2. Aba No-Shows (`src/hooks/useR2NoShowLeads.ts` + `src/components/crm/R2NoShowsPanel.tsx`)

**Passo 1: Atualizar hook para incluir r1_closer_id**

No `useR2NoShowLeads.ts`, modificar o mapeamento R1 para incluir o ID:

```typescript
// Interface atualizada
export interface R2NoShowLead {
  // ... campos existentes ...
  r1_closer_id: string | null;    // NOVO
  r1_closer_name: string | null;
}

// r1Map atualizado
let r1Map = new Map<string, { 
  closer_id: string | null;       // NOVO
  closer_name: string | null; 
  date: string | null 
}>();

// Na query R1, ja busca closer.id (verificar se precisa ajuste)
```

**Passo 2: Adicionar filtro no painel**

No `R2NoShowsPanel.tsx`:

```typescript
// Adicionar import
import { useGestorClosers } from '@/hooks/useGestorClosers';

// Adicionar estado
const [r1CloserFilter, setR1CloserFilter] = useState<string>('all');

// Buscar closers R1
const { data: r1Closers = [] } = useGestorClosers('r1');

// Filtrar leads (client-side)
const filteredLeads = useMemo(() => {
  if (r1CloserFilter === 'all') return leads;
  return leads.filter(l => l.r1_closer_id === r1CloserFilter);
}, [leads, r1CloserFilter]);
```

**UI - Adicionar dropdown ao lado do filtro existente:**
```text
+--------------------------------------------------------+
| Periodo: [Dia] [Semana] [Mes]  [Personalizado]         |
|                                                        |
| Socio R2: [Todos ▼]   Closer R1: [Todos ▼]            |
+--------------------------------------------------------+
```

---

## Fluxo de Dados

```text
Pendentes:
  useR2PendingLeads
      |
      v
  meeting_slot.closer.id  <-- Este E o closer R1
      |
      v
  Filtro client-side por r1CloserFilter


No-Shows:
  useR2NoShowLeads
      |
      v
  r1Map[deal_id] = { closer_id, closer_name, date }
      |
      v
  R2NoShowLead.r1_closer_id  <-- NOVO campo
      |
      v
  Filtro client-side por r1CloserFilter
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/crm/R2PendingLeadsPanel.tsx` | Adicionar estado, hook useGestorClosers, dropdown UI, filtro client-side |
| `src/hooks/useR2NoShowLeads.ts` | Adicionar `r1_closer_id` na interface e no mapeamento |
| `src/components/crm/R2NoShowsPanel.tsx` | Adicionar estado, hook, dropdown UI, filtro client-side |

---

## Secao Tecnica

### Dados Disponiveis

**Pendentes (useR2PendingLeads):**
- `meeting_slot.closer.id` - ID do closer que fez R1
- `meeting_slot.closer.name` - Nome do closer R1

**No-Shows (useR2NoShowLeads):**
- `r1_closer_name` - Ja existe
- `r1_closer_id` - Precisa adicionar (vem da query R1 existente)

### Hook useGestorClosers

Ja utilizado na AgendaR2.tsx, retorna closers filtrados por `meeting_type = 'r1'`:
- Julio
- Thayna
- Cristiane Gomes
- Mateus Macedo
- etc.
