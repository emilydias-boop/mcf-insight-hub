
# Plano: Adicionar Drawer de Detalhes nos Cards de No-Show

## Problema Identificado

Na aba "No-Shows" da Agenda R2, os cards de leads não permitem:
1. Clicar para abrir o drawer de detalhes (`R2MeetingDetailDrawer`)
2. Ver informações completas como qualificação, avaliação R2, notas e timeline

## Solução

Adicionar funcionalidade de clique no card para abrir o drawer de detalhes, semelhante ao comportamento da lista principal de reuniões R2.

## Sobre a Dúvida do Reagendamento

Quando uma reunião R2 é reagendada:

| Campo | Valor |
|-------|-------|
| Status da reunião | `rescheduled` |
| Visibilidade na agenda | Continua aparecendo normalmente |
| Contagem para Closer R1 | **SIM** - continua contando |

A query de métricas do Closer R1 (`useR1CloserMetrics.ts` linha 97) **não exclui** reuniões com status `rescheduled`, apenas `cancelled`. Portanto, a R2 reagendada **continua sendo atribuída ao closer R1**.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/R2NoShowsPanel.tsx` | Adicionar estado e callback para abrir drawer |

## Mudanças no Código

### R2NoShowsPanel.tsx

1. **Adicionar estado para o drawer:**
   - `detailDrawerOpen: boolean`
   - `selectedMeetingForDrawer: R2MeetingRow | null`

2. **Modificar NoShowCard:**
   - Adicionar prop `onClick` para abrir drawer
   - Tornar o card clicável (cursor pointer)

3. **Converter R2NoShowLead para R2MeetingRow:**
   - Criar função de conversão para compatibilidade com o drawer existente

4. **Adicionar R2MeetingDetailDrawer:**
   - Importar e renderizar o drawer
   - Passar as props necessárias

## Fluxo de Implementação

```text
1. Adicionar estados para controle do drawer
          ↓
2. Criar função de conversão lead → meetingRow
          ↓
3. Adicionar onClick no NoShowCard
          ↓
4. Importar e renderizar R2MeetingDetailDrawer
          ↓
5. Testar: clique no card abre drawer com detalhes
```

## Detalhes Técnicos

### Conversão R2NoShowLead para R2MeetingRow

O drawer `R2MeetingDetailDrawer` espera um `R2MeetingRow`. Precisamos converter o `R2NoShowLead`:

```typescript
const convertToMeetingRow = (lead: R2NoShowLead): R2MeetingRow => ({
  id: lead.meeting_id,
  scheduled_at: lead.scheduled_at,
  status: 'no_show',
  notes: null,
  closer: {
    id: lead.closer_id,
    name: lead.closer_name,
    color: lead.closer_color,
  },
  attendees: [{
    id: lead.id,
    deal_id: lead.deal_id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    status: 'no_show',
    already_builds: lead.already_builds,
    lead_profile: lead.lead_profile,
    deal: lead.deal ? {
      id: lead.deal_id || '',
      name: lead.deal.name,
      contact: {
        name: lead.name,
        phone: lead.phone || '',
        email: lead.email || '',
        tags: [],
      },
      custom_fields: lead.deal.custom_fields,
    } : undefined,
  }],
  sdr: lead.sdr_name ? { name: lead.sdr_name } : undefined,
  r1_closer: lead.r1_closer_name ? {
    name: lead.r1_closer_name,
    scheduled_at: lead.r1_date,
  } : undefined,
  created_at: lead.scheduled_at,
});
```

### NoShowCard com onClick

```typescript
function NoShowCard({ 
  lead, 
  onReschedule,
  onClick 
}: { 
  lead: R2NoShowLead; 
  onReschedule: () => void;
  onClick: () => void;
}) {
  return (
    <Card 
      className="border-l-4 border-l-destructive hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      ...
      <Button 
        onClick={(e) => {
          e.stopPropagation(); // Previne abrir o drawer
          onReschedule();
        }}
      >
        Reagendar R2
      </Button>
      ...
    </Card>
  );
}
```

## Interface Esperada

```text
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 Jhonatan Garcia Felicio                    [Reagendar R2] → │
│    📞 +55319990...  |  📧 jhonata@...                          │
│    📅 R2 era: 27/01 às 17:00                                    │
│    👤 Sócio R2: Claudia Carielo                                 │
│    📌 SDR: Cristiane Gomes                                      │
└─────────────────────────────────────────────────────────────────┘
      ↑ Clique abre drawer →  ┌───────────────────────────────────┐
                              │ Detalhes R2                       │
                              │ ─────────────────────────────────│
                              │ Participantes (1)                 │
                              │ [Jhonatan] [Selecionado] [🗑️]     │
                              │ ─────────────────────────────────│
                              │ 📅 Terça, 27 de janeiro           │
                              │ 👤 Closer R2: Claudia             │
                              │ ─────────────────────────────────│
                              │ [Qualificação][Avaliação][Notas]  │
                              │ ─────────────────────────────────│
                              │ [✓ Realizada] [✗ No-show]         │
                              │ [🕐 Reagendar] [↩ Reembolso]      │
                              │ [🗑️ Cancelar Reunião]              │
                              └───────────────────────────────────┘
```

## Benefícios

1. **Consistência**: Mesmo comportamento da lista principal de R2
2. **Informações Completas**: Acesso às abas de qualificação, avaliação e notas
3. **Ações Rápidas**: Todas as ações do drawer disponíveis (realizada, no-show, reagendar, cancelar)
4. **Fluxo Intuitivo**: Usuário pode clicar para ver mais ou ir direto para reagendar
