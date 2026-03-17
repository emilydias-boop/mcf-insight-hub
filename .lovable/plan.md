

## Bug: Leads reagendados contando como No-Show

### Causa raiz

Encontrei **dois problemas** que causam esse bug:

**1. `useRescheduleMeeting` nao atualiza o status dos attendees**

Quando uma reuniao e reagendada pelo `RescheduleModal`, o codigo atualiza o `meeting_slot.status` para `'rescheduled'`, mas **nao altera o status dos attendees** (`meeting_slot_attendees`). Os participantes continuam com status `invited`/`scheduled`.

**2. RPC `get_sdr_metrics_from_agenda` calcula no-shows de forma errada**

A funcao SQL calcula no-shows como `agendamentos - r1_realizada` (linha 74 da RPC), em vez de contar os attendees com `status = 'no_show'`. Alem disso, o filtro exclui apenas `cancelled` (`WHERE msa.status != 'cancelled'`), sem excluir `rescheduled`. Resultado: attendees reagendados inflam os agendamentos e, como nao sao `completed`, aparecem como no-show.

---

### Correcoes

**1. `src/hooks/useAgendaData.ts` — `useRescheduleMeeting`**

Apos atualizar o slot (linha ~1349), adicionar update dos attendees para `status: 'rescheduled'`:

```ts
// Apos atualizar o meeting_slot, atualizar todos os attendees
await supabase
  .from('meeting_slot_attendees')
  .update({ status: 'rescheduled' })
  .eq('meeting_slot_id', meetingId);
```

**2. Migration SQL — Corrigir `get_sdr_metrics_from_agenda`**

- Alterar o filtro de `WHERE msa.status != 'cancelled'` para `WHERE msa.status NOT IN ('cancelled', 'rescheduled')` — excluindo attendees reagendados de todas as contagens
- Alterar o calculo de no-shows de `agendamentos - r1_realizada` para uma contagem real: `COUNT(CASE WHEN msa.status = 'no_show' AND scheduled_at no periodo THEN 1 END)`

**3. `src/hooks/useInvestigationByPeriod.ts`**

Adicionar exclusao de attendees com `status = 'rescheduled'` no filtro `nonPartner`:

```ts
const nonPartner = attendees.filter(a => !a.is_partner && a.status !== 'rescheduled');
```

**4. `src/hooks/useMeetingSlotsKPIs.ts`**

Mesma correcao: excluir attendees `rescheduled` da contagem de `totalAgendadas`.

---

### Impacto

Apos as correcoes:
- Reagendar uma reuniao marca os attendees como `rescheduled`
- Attendees reagendados nao contam em nenhuma metrica (agendamentos, realizadas, ou no-shows)
- Apenas attendees com `status = 'no_show'` explicito contam como no-show

