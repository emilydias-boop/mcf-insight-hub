
# Plano: Implementar Agenda R1 para BU Consórcio com Filtros por Origin

## Visão Geral

A Agenda de R1 do Consórcio precisa:
1. **Mostrar apenas closers** cadastrados com `bu = 'consorcio'`
2. **Filtrar leads na busca** para mostrar apenas deals das pipelines de Consórcio
3. **Permitir cadastrar closers** com a BU correta

Atualmente:
- Todos os closers têm `bu = 'incorporador'`
- A busca de deals (`useSearchDealsForSchedule`) não filtra por origin
- O formulário de closers não tem campo para selecionar BU

---

## Mapeamento de Origens para Consórcio

Baseado na análise do banco de dados, estas são as origens/grupos do Consórcio:

| Grupo | ID | Origens Incluídas |
|-------|----|--------------------|
| Perpétuo - Construa para Alugar | `b98e3746-d727-445b-b878-fc5742b6e6b8` | PIPE LINE - INSIDE SALES |
| Hubla - Viver de Aluguel | `267905ec-8fcf-4373-8d62-273bb6c6f8ca` | Lista Geral, Compras em aberto, Reembolso |
| Hubla - Construir Para Alugar | `35361575-d8a9-4ea0-8703-372a2988d2be` | Assinaturas ativas/atraso, Compras |
| PIPELINE INSIDE SALES - VIVER DE ALUGUEL | `4e2b810a-6782-4ce9-9c0d-10d04c018636` | (origin direta no grupo Perpétuo X1) |

---

## Alterações Necessárias

### 1) Atualizar Mapeamento BU_PIPELINE_MAP

**Arquivo:** `src/components/auth/NegociosAccessGuard.tsx`

Definir as origens e grupos do Consórcio:

```typescript
consorcio: [
  'b98e3746-d727-445b-b878-fc5742b6e6b8', // Grupo: Perpétuo - Construa para Alugar
  '267905ec-8fcf-4373-8d62-273bb6c6f8ca', // Grupo: Hubla - Viver de Aluguel
  '35361575-d8a9-4ea0-8703-372a2988d2be', // Grupo: Hubla - Construir Para Alugar
  '4e2b810a-6782-4ce9-9c0d-10d04c018636', // Origin: PIPELINE INSIDE SALES - VIVER DE ALUGUEL
],
```

---

### 2) Adicionar Campo de BU no Formulário de Closers

**Arquivo:** `src/components/crm/CloserFormDialog.tsx`

Adicionar um `Select` para escolher a Business Unit:

```typescript
<div className="space-y-2">
  <Label htmlFor="bu">Business Unit *</Label>
  <Select
    value={formData.bu || 'incorporador'}
    onValueChange={(v) => setFormData({ ...formData, bu: v })}
  >
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="incorporador">BU - Incorporador MCF</SelectItem>
      <SelectItem value="consorcio">BU - Consórcio</SelectItem>
      <SelectItem value="credito">BU - Crédito</SelectItem>
      <SelectItem value="projetos">BU - Projetos</SelectItem>
      <SelectItem value="leilao">BU - Leilão</SelectItem>
    </SelectContent>
  </Select>
</div>
```

**Arquivo:** `src/hooks/useClosers.ts`

Adicionar campo `bu` nas interfaces:

```typescript
export interface Closer {
  // ... campos existentes
  bu: string | null;
}

export interface CloserFormData {
  // ... campos existentes
  bu?: string;
}
```

---

### 3) Filtrar Deals por Origin na Busca de Agendamento

**Arquivo:** `src/hooks/useAgendaData.ts`

Modificar `useSearchDealsForSchedule` para aceitar `originIds`:

```typescript
export function useSearchDealsForSchedule(query: string, originIds?: string[]) {
  return useQuery({
    queryKey: ['schedule-search', query, originIds],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      let dealsQuery = supabase
        .from('crm_deals')
        .select(`id, name, tags, contact:crm_contacts(...), stage:crm_stages(...)`)
        .ilike('name', `%${query}%`);
      
      // Filtrar por origin_id se especificado
      if (originIds && originIds.length > 0) {
        dealsQuery = dealsQuery.in('origin_id', originIds);
      }
      
      const { data: dealsByName } = await dealsQuery.limit(10);
      // ... resto da lógica
    },
  });
}
```

---

### 4) Passar Origin Filter no QuickScheduleModal

**Arquivo:** `src/components/crm/QuickScheduleModal.tsx`

Usar `useActiveBU()` e buscar origens corretas:

```typescript
import { useActiveBU } from '@/hooks/useActiveBU';
import { BU_PIPELINE_MAP } from '@/components/auth/NegociosAccessGuard';

// Dentro do componente
const activeBU = useActiveBU();
const originIds = activeBU ? BU_PIPELINE_MAP[activeBU] : undefined;

// Passar para a busca
const { data: searchResults } = useSearchDealsForSchedule(nameQuery, originIds);
```

---

### 5) Exibir Coluna BU na Lista de Closers

**Arquivo:** `src/pages/crm/ConfigurarClosers.tsx`

Adicionar coluna "BU" na tabela e filtro por BU:

```typescript
// Coluna na tabela
<TableHead>BU</TableHead>

// Célula
<TableCell>
  <Badge variant="outline">
    {closer.bu === 'consorcio' ? 'Consórcio' : 
     closer.bu === 'incorporador' ? 'Incorporador' : 
     closer.bu || 'N/A'}
  </Badge>
</TableCell>

// Filtro baseado na rota ativa
const activeBU = useActiveBU();
const filteredClosers = closers?.filter(c => 
  !activeBU || c.bu === activeBU
);
```

---

## Fluxo de Dados

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    /consorcio/crm/agenda                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  BUCRMLayout (bu='consorcio')                                       │
│    └── Agenda.tsx                                                   │
│          ├── useActiveBU() → 'consorcio'                            │
│          ├── useClosersWithAvailability('consorcio')                │
│          │     └── SELECT * FROM closers WHERE bu = 'consorcio'     │
│          │                                                          │
│          └── QuickScheduleModal                                     │
│                ├── useActiveBU() → 'consorcio'                      │
│                ├── BU_PIPELINE_MAP['consorcio'] → originIds         │
│                │     [                                              │
│                │       'b98e3746-...',  // Perpétuo Construa        │
│                │       '267905ec-...',  // Hubla Viver              │
│                │       '35361575-...',  // Hubla Construir          │
│                │       '4e2b810a-...',  // Pipeline INSIDE SALES    │
│                │     ]                                              │
│                └── useSearchDealsForSchedule(query, originIds)      │
│                      └── WHERE origin_id IN (...)                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/auth/NegociosAccessGuard.tsx` | Definir originIds para `consorcio` em BU_PIPELINE_MAP |
| `src/hooks/useClosers.ts` | Adicionar campo `bu` nas interfaces |
| `src/components/crm/CloserFormDialog.tsx` | Adicionar Select de BU |
| `src/hooks/useAgendaData.ts` | Adicionar parâmetro `originIds` em `useSearchDealsForSchedule` |
| `src/components/crm/QuickScheduleModal.tsx` | Passar `originIds` baseado na BU ativa |
| `src/pages/crm/ConfigurarClosers.tsx` | Exibir coluna BU e filtrar por BU ativa |

---

## Próximos Passos Após Implementação

1. **Cadastrar Closers de Consórcio**: Acessar `/consorcio/crm/configuracoes` e criar closers com `bu = 'consorcio'`
2. **Configurar Disponibilidade**: Definir horários de atendimento para cada closer
3. **Testar Agendamento**: Verificar que apenas leads de Consórcio aparecem na busca

---

## Resultado Esperado

1. Agenda em `/consorcio/crm/agenda` mostra apenas closers com `bu = 'consorcio'`
2. Busca de leads filtra apenas deals das pipelines de Consórcio
3. SDRs de Consórcio não veem leads de Incorporador na busca
4. Cada BU trabalha de forma isolada com seus próprios closers e leads
