
# Bloquear agendamento duplicado com regras de prazo

## Problema
O sistema permite agendar o mesmo lead multiplas vezes sem verificacao. Precisamos bloquear reagendamento com regras diferentes por status:

- **Reuniao ativa** (scheduled/invited/rescheduled): bloqueio total
- **No-Show**: liberado imediatamente para reagendar
- **Realizada** (completed): prazo de 30 dias antes de permitir novo agendamento

## O que muda para o usuario

Ao tentar agendar um lead:
- Se ja tem reuniao **pendente**: alerta vermelho "Este lead ja possui reuniao agendada para DD/MM as HH:MM. Finalize antes de reagendar." Botao desabilitado.
- Se tem reuniao **realizada ha menos de 30 dias**: alerta amarelo "Este lead teve reuniao realizada em DD/MM. Novo agendamento liberado a partir de DD/MM." Botao desabilitado.
- Se tem reuniao **realizada ha mais de 30 dias** ou **no-show**: sem bloqueio, agendamento normal.

## Detalhes tecnicos

### 1. Novo hook: `src/hooks/useCheckActiveMeeting.ts`

Recebe `dealId` (e opcionalmente `contactPhone`) e faz query em `meeting_slot_attendees` + `meeting_slots`:

- Verifica se existe attendee com status `invited`/`scheduled` em slot com status `scheduled`/`rescheduled` (bloqueio total)
- Verifica se existe attendee com status `completed` cuja `scheduled_at` esta dentro dos ultimos 30 dias (bloqueio com prazo)
- Retorna `{ blocked: boolean; reason: string; unblockDate?: Date; activeMeetingDate?: Date }`

### 2. Frontend - `QuickScheduleModal.tsx` (R1)

Apos selecionar o deal:
- Chamar `useCheckActiveMeeting(selectedDealId)`
- Se `blocked`, exibir alerta (Alert component) com a mensagem e desabilitar botao de confirmar
- Alerta vermelho para reuniao ativa, amarelo para prazo de 30 dias

### 3. Frontend - `R2QuickScheduleModal.tsx` (R2)

Mesma logica do R1, adaptada para o modal R2.

### 4. Backend guard - `calendly-create-event/index.ts`

Adicionar verificacao antes de criar o attendee:
- Mesma logica do hook (reuniao ativa ou realizada ha menos de 30 dias)
- Se bloqueado, retornar `{ success: false, error: "Lead ja possui reuniao ativa/recente" }`
- Isso garante protecao mesmo se o frontend for burlado

### Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| `src/hooks/useCheckActiveMeeting.ts` | Criar |
| `src/components/crm/QuickScheduleModal.tsx` | Modificar - adicionar alerta |
| `src/components/crm/R2QuickScheduleModal.tsx` | Modificar - adicionar alerta |
| `supabase/functions/calendly-create-event/index.ts` | Modificar - guard backend |
