

## Pré-Agendamento R2: Fluxo de Confirmação

### Contexto

Hoje o fluxo é: Closer R1 → R1 realizada → Contrato pago → Lead aparece na lista "Pendentes" da Agenda R2 → Alguém agenda o R2 diretamente.

O novo fluxo adiciona uma etapa intermediária: o **Closer de R1** faz um **pré-agendamento** (escolhe closer R2, data e horário), e depois a **Leticia** (confirmadora) entra em contato com o lead para confirmar. Só após confirmação o agendamento fica "oficial".

### Mudanças necessárias

**1. Novo status de attendee: `pre_scheduled`**

Adicionar um novo status ao fluxo do `meeting_slot_attendees`. Atualmente os status são: `invited`, `scheduled`, `completed`, `no_show`, `contract_paid`, `rescheduled`, `refunded`. O novo `pre_scheduled` indica que o Closer R1 marcou o horário mas ainda falta confirmação.

**2. Banco de dados**
- Nenhuma migração de schema necessária (o campo `status` em `meeting_slot_attendees` é `text`, aceita qualquer valor)
- Adicionar coluna opcional `confirmed_by` (uuid, nullable) em `meeting_slot_attendees` para rastrear quem confirmou
- Adicionar coluna opcional `confirmed_at` (timestamptz, nullable) para quando foi confirmado

**3. Modificar `useCreateR2Meeting` (src/hooks/useR2AgendaData.ts)**
- Aceitar novo parâmetro `isPreSchedule: boolean`
- Quando `isPreSchedule = true`, criar o attendee com `status: 'pre_scheduled'` em vez de `'invited'`
- O slot em `meeting_slots` fica com `status: 'scheduled'` normalmente (reserva o horário)

**4. Modificar `R2QuickScheduleModal` (src/components/crm/R2QuickScheduleModal.tsx)**
- Adicionar checkbox/toggle "Pré-agendamento (aguarda confirmação)"
- Quando ativado, passa `isPreSchedule: true` para o `useCreateR2Meeting`
- Disponibilizar esse toggle quando o agendamento vier da lista de Pendentes ou do Closer R1

**5. Nova aba/seção: "Pré-Agendados" na Agenda R2**
- Criar hook `useR2PreScheduledLeads` que busca attendees com `status = 'pre_scheduled'`
- Listar com: nome do lead, telefone, closer R2, data/hora agendada, quem pré-agendou
- Botões de ação: **Confirmar** (muda para `invited`) ou **Cancelar**
- A confirmação registra `confirmed_by` e `confirmed_at`

**6. Atualizar visualizações existentes**
- `ATTENDEE_STATUS_CONFIG` em `AgendaCalendar.tsx` e `CloserColumnCalendar.tsx`: adicionar `pre_scheduled` com label "Pré" e cor amarela/laranja para diferenciar visualmente
- `formatMeetingStatus.ts`: adicionar mapeamento `pre_scheduled → "Pré-agendado"`
- Calendário R2: mostrar leads pré-agendados com estilo visual diferenciado (borda tracejada ou opacidade reduzida)
- Contagem de capacidade (`useR2CloserAvailableSlots`): pré-agendados **devem** ocupar slot (reservar horário)

**7. Fluxo de Pendentes**
- Na lista `R2PendingLeadsPanel`, ao clicar "Agendar", abrir o modal com o toggle de pré-agendamento visível
- Leads pré-agendados devem **sair** da lista de pendentes (já têm horário reservado)

### Resumo do fluxo

```text
Closer R1 marca R2 (pre_scheduled)
         │
         ▼
Leticia vê na aba "Pré-Agendados"
         │
    ┌────┴────┐
    ▼         ▼
Confirma    Cancela
(→ invited)  (→ cancelled)
    │
    ▼
Aparece normal no calendário R2
```

### Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| SQL migration | Adicionar `confirmed_by` e `confirmed_at` em `meeting_slot_attendees` |
| `src/hooks/useR2AgendaData.ts` | Parâmetro `isPreSchedule` no `useCreateR2Meeting` |
| `src/hooks/useR2PreScheduledLeads.ts` | **Novo** - hook para buscar pré-agendados |
| `src/components/crm/R2PreScheduledTab.tsx` | **Novo** - aba com lista de pré-agendados e ações |
| `src/components/crm/R2QuickScheduleModal.tsx` | Toggle de pré-agendamento |
| `src/pages/crm/AgendaR2.tsx` | Adicionar aba "Pré-Agendados" |
| `src/components/crm/AgendaCalendar.tsx` | Status visual para `pre_scheduled` |
| `src/components/crm/CloserColumnCalendar.tsx` | Status visual para `pre_scheduled` |
| `src/utils/formatMeetingStatus.ts` | Mapeamento do novo status |

