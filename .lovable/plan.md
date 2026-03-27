

## Fix: Cancelamento de Pre-Agendamento nao Remove do Calendario

### Problema

Ao cancelar um pre-agendamento pela aba "Pre-Agendados", o sistema apenas atualiza o status do attendee para `cancelled`, mas:
1. O `meeting_slot` continua existindo
2. A query da agenda (`useR2AgendaMeetings`) nao filtra attendees cancelados — entao o item continua visivel no calendario
3. So desaparece quando vai no drawer e exclui manualmente

### Correcao

**Arquivo 1: `src/hooks/useR2PreScheduledLeads.ts` — `useCancelR2PreScheduled`**

Ao cancelar um pre-agendamento, alem de atualizar o status do attendee, tambem deletar o attendee e o meeting_slot (mesmo comportamento do `useCancelR2Meeting` no drawer). Passos:
1. Buscar `meeting_slot_id` do attendee
2. Deletar o attendee
3. Deletar o meeting_slot (pre-agendamentos sempre tem 1 attendee so)
4. Invalidar todas as queries relevantes

**Arquivo 2: `src/hooks/useR2AgendaMeetings.ts`**

Como protecao adicional, filtrar attendees com status `cancelled` no pos-processamento. Apos o map de attendees, filtrar `att.status !== 'cancelled'`. Manter o filtro de "orphan slots" (meetings sem attendees apos filtro).

### Resultado

- Cancelar da aba "Pre-Agendados" remove imediatamente do calendario
- Mesmo se houver attendees cancelados por outro caminho, eles nao aparecem na agenda

### O que NAO muda
- Fluxo de confirmacao de pre-agendamento
- `useCancelR2Meeting` no drawer (ja funciona corretamente)
- Nenhuma migration

