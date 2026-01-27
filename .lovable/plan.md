

# Plano: Melhorar a Aba "R2 Agendadas" no Carrinho R2

## Resumo das Mudancas Solicitadas

1. **Mostrar TODOS os 34 attendees da semana** - Independente do status (agendada, no-show, realizada, reprovada, etc.)
2. **A data exibida deve ser a data da REUNIAO** (scheduled_at) com horarios - Atualmente ja usa scheduled_at, mas precisa confirmar que esta correto
3. **Ao clicar em uma linha, abrir o drawer de detalhes** - Integrar o R2MeetingDetailDrawer

---

## Problema Atual

### Filtro Restritivo no Hook useR2CarrinhoData

Na linha 90-91 do arquivo `src/hooks/useR2CarrinhoData.ts`:

```typescript
if (filter === 'agendadas') {
  query = query.in('status', ['scheduled', 'invited', 'pending']);
}
```

Isso filtra apenas reunioes com status "agendada", excluindo:
- `completed` (Realizada)
- `no_show`
- `cancelled`
- `rescheduled`
- `contract_paid`

### Sem Integracao com o Drawer de Detalhes

A aba R2 Agendadas nao tem integracao com o drawer de detalhes. O componente `R2AgendadasList` recebe `onSelectAttendee` mas a pagina `R2Carrinho.tsx` nao passa essa prop nem tem estado para controlar o drawer.

---

## Mudancas Propostas

### 1. Criar Nova Opcao de Filtro no Hook (ou remover filtro para agendadas)

**Arquivo:** `src/hooks/useR2CarrinhoData.ts`

Modificar o filtro `agendadas` para incluir TODOS os attendees da semana (exceto cancelados):

```typescript
if (filter === 'agendadas') {
  // Mostrar TODOS os attendees R2 da semana (exceto cancelados e reagendados)
  query = query.not('status', 'in', '(cancelled,rescheduled)');
}
```

### 2. Atualizar R2AgendadasList para Mostrar Status Dinâmico

**Arquivo:** `src/components/crm/R2AgendadasList.tsx`

Modificar para:
- Exibir o status REAL de cada attendee (Agendada, Realizada, No-show, etc.)
- Badge com cor correspondente ao status
- Manter o agrupamento por data da reuniao (scheduled_at)
- Confirmar que ja usa a data correta (scheduled_at = data da reuniao)

Mapa de status a ser adicionado:
```typescript
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendada', color: 'bg-blue-500 text-white' },
  invited: { label: 'Convidado', color: 'bg-purple-500 text-white' },
  completed: { label: 'Realizada', color: 'bg-green-500 text-white' },
  no_show: { label: 'No-show', color: 'bg-red-500 text-white' },
  contract_paid: { label: 'Contrato Pago', color: 'bg-emerald-600 text-white' },
  refunded: { label: 'Reembolsado', color: 'bg-orange-500 text-white' },
  pending: { label: 'Pendente', color: 'bg-yellow-500 text-black' },
};
```

### 3. Integrar Drawer de Detalhes na Pagina R2Carrinho

**Arquivo:** `src/pages/crm/R2Carrinho.tsx`

Adicionar:
- Estado para armazenar o attendee selecionado
- Estado para controlar abertura do drawer
- Funcao para converter R2CarrinhoAttendee para R2MeetingRow (formato esperado pelo drawer)
- Buscar dados adicionais via useR2MeetingsExtended ou criar hook simplificado
- Integrar o R2MeetingDetailDrawer no componente

---

## Detalhes Tecnicos

### Arquivo 1: `src/hooks/useR2CarrinhoData.ts`

**Linha 90-91** - Modificar filtro:

```typescript
// ANTES
if (filter === 'agendadas') {
  query = query.in('status', ['scheduled', 'invited', 'pending']);
}

// DEPOIS
if (filter === 'agendadas') {
  // Mostrar TODOS os attendees R2 da semana, exceto cancelados
  query = query.not('status', 'in', '(cancelled,rescheduled)');
}
```

### Arquivo 2: `src/components/crm/R2AgendadasList.tsx`

Modificacoes:
1. Adicionar mapa de status com labels e cores
2. Usar o status real do attendee para exibir badge
3. Confirmar que onSelectAttendee esta sendo chamado corretamente

### Arquivo 3: `src/pages/crm/R2Carrinho.tsx`

Adicionar imports e estado:
```typescript
import { R2MeetingDetailDrawer } from '@/components/crm/R2MeetingDetailDrawer';
import { useR2MeetingsExtended } from '@/hooks/useR2MeetingsExtended';
import { useR2ThermometerOptions } from '@/hooks/useR2StatusOptions';
import { R2MeetingRow, R2StatusOption, R2ThermometerOption } from '@/types/r2Agenda';

// Adicionar estados
const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
const [drawerOpen, setDrawerOpen] = useState(false);

// Buscar dados estendidos para o drawer
const { data: meetingsExtended = [] } = useR2MeetingsExtended(weekStart, weekEnd);
const { data: thermometerOptions = [] } = useR2ThermometerOptions();
```

Adicionar handler para selecao:
```typescript
const handleSelectAttendee = (attendee: R2CarrinhoAttendee) => {
  setSelectedMeetingId(attendee.meeting_id);
  setDrawerOpen(true);
};

// Encontrar a meeting correspondente nos dados estendidos
const selectedMeeting = useMemo(() => {
  if (!selectedMeetingId) return null;
  return meetingsExtended.find(m => m.id === selectedMeetingId) || null;
}, [selectedMeetingId, meetingsExtended]);
```

Passar handler para R2AgendadasList:
```typescript
<R2AgendadasList 
  attendees={agendadasData} 
  isLoading={agendadasLoading}
  onSelectAttendee={handleSelectAttendee}
/>
```

Adicionar drawer no final do componente:
```typescript
<R2MeetingDetailDrawer
  meeting={selectedMeeting}
  statusOptions={statusOptions}
  thermometerOptions={thermometerOptions}
  open={drawerOpen}
  onOpenChange={setDrawerOpen}
  onReschedule={() => {}}
/>
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Mostra apenas status "scheduled/invited/pending" | Mostra TODOS os 34 attendees da semana |
| Badge sempre "Agendada" | Badge dinamico (Agendada/Realizada/No-show/etc.) |
| Clique nao faz nada | Clique abre drawer de detalhes completo |
| Data correta (scheduled_at) | Mantido - data da reuniao com horario |

### Arquivos a Modificar

| Arquivo | Tipo de Mudanca |
|---------|-----------------|
| `src/hooks/useR2CarrinhoData.ts` | Alterar filtro de status na query |
| `src/components/crm/R2AgendadasList.tsx` | Adicionar mapa de status e badge dinamico |
| `src/pages/crm/R2Carrinho.tsx` | Integrar drawer de detalhes e estados |

