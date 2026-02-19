

# Timeline Completa do Lead no Drawer

## Objetivo
Criar uma aba "Timeline" unificada dentro do `DealDetailsDrawer` que consolida TODAS as informacoes do lead em ordem cronologica, substituindo a necessidade de navegar entre multiplas abas para entender o historico completo.

## O que sera exibido (em ordem cronologica)

| Evento | Fonte de Dados | Icone |
|--------|---------------|-------|
| Movimentacoes de estagio | `deal_activities` (stage_change) | Seta |
| Ligacoes realizadas | `calls` | Telefone |
| Notas manuais | `deal_activities` (note) + `attendee_notes` | Documento |
| Reunioes agendadas/realizadas | `meeting_slot_attendees` + `meeting_slots` | Calendario |
| Tarefas completadas | `deal_activities` (task_completed) | Check |
| Compras/Transacoes | `hubla_transactions` (por email) | Carrinho |
| Qualificacao | `deal_activities` (qualification_note) | Estrela |
| Notas do Closer | `meeting_slot_attendees.closer_notes` | Mensagem |

## Implementacao

### 1. Novo Hook: `useLeadFullTimeline.ts`
Um hook que busca dados de TODAS as fontes e os unifica em uma unica lista cronologica:

```text
interface TimelineEvent {
  id: string;
  type: 'stage_change' | 'call' | 'note' | 'meeting' | 'task' | 'purchase' | 'qualification';
  title: string;
  description: string | null;
  date: string;
  author: string | null;
  metadata: Record<string, any>;
}
```

Queries paralelas ao Supabase:
- `deal_activities` - todas as atividades do deal (por deal_id e deal uuid)
- `calls` - ligacoes vinculadas ao deal
- `meeting_slot_attendees` + `meeting_slots` - reunioes do deal
- `hubla_transactions` - transacoes pelo email do contato
- `attendee_notes` - notas de attendees vinculados ao deal

Todas unificadas, ordenadas por data decrescente.

### 2. Novo Componente: `LeadFullTimeline.tsx`
Componente visual que renderiza a timeline como uma lista vertical com:
- Linha vertical conectando os eventos
- Icone colorido por tipo de evento
- Titulo do evento
- Descricao/detalhes expansiveis
- Data/hora formatada
- Autor quando disponivel
- Badges de contexto (ex: estagio, status da ligacao, valor da compra)
- Filtro rapido por tipo de evento no topo

### 3. Adicionar Nova Aba no Drawer
No `DealDetailsDrawer.tsx`, adicionar a aba "Timeline" como a PRIMEIRA aba (default) nas tabs existentes, mudando o grid de 4 para 5 colunas:

```text
Tabs: [Timeline] [Tarefas] [Historico] [Ligacoes] [Notas]
```

A aba Timeline recebera `dealId`, `dealUuid` e `contactEmail` como props.

### Arquivos Modificados
1. **Novo**: `src/hooks/useLeadFullTimeline.ts` - Hook de dados unificados
2. **Novo**: `src/components/crm/LeadFullTimeline.tsx` - Componente visual da timeline
3. **Editado**: `src/components/crm/DealDetailsDrawer.tsx` - Adicionar aba Timeline

### Comportamento
- Timeline abre expandida por padrao como primeira aba
- Scroll infinito dentro da aba
- Cada tipo de evento tem cor e icone distintos para facil identificacao visual
- Eventos expansiveis para ver detalhes (notas completas, gravacoes, etc.)
- Filtro por tipo no topo da timeline para focar em um tipo especifico
