

## Correções na aba Reuniões do SDR Detail

### Problemas identificados

1. **Horário mostrando 00:00** — A RPC `get_sdr_meetings_from_agenda` retorna `data_agendamento` como `::date::text` (só a data, sem hora). O campo `scheduled_at` contém o timestamp completo mas não é usado na renderização.

2. **Falta distinção entre "agendadas PARA o dia" vs "agendadas NO dia"** — Hoje a tabela mostra reuniões cujo `scheduled_at` cai no período filtrado (reuniões que vão acontecer). Não há visibilidade sobre quando o SDR fez o agendamento (campo `booked_at` do `meeting_slot_attendees`).

### Plano

**1. Corrigir horário na tabela** (`src/components/sdr/SdrLeadsTable.tsx`)
- Usar `meeting.scheduled_at` (timestamp completo) em vez de `meeting.data_agendamento` para exibir data/hora
- Fallback para `data_agendamento` se `scheduled_at` for null

**2. Adicionar coluna "Agendado em"** (`src/components/sdr/SdrLeadsTable.tsx`)
- Nova coluna mostrando a data em que o SDR criou o agendamento
- Usa o campo `booked_at` que já existe em `meeting_slot_attendees`

**3. Expor `booked_at` nos dados** — Verificar se a RPC já retorna ou se precisa ser adicionado:
- A RPC `get_sdr_meetings_from_agenda` **não retorna** `booked_at` atualmente
- Criar migration para adicionar `booked_at` ao RETURNS TABLE da RPC (via `msa.booked_at::text`)
- Atualizar `MeetingV2` interface e o hook `useSdrMeetingsFromAgenda` para incluir o novo campo

### Arquivos afetados
- `supabase/migrations/[new].sql` — Recriar RPC com campo `booked_at`
- `src/hooks/useSdrMetricsV2.ts` — Adicionar `booked_at` ao `MeetingV2`
- `src/hooks/useSdrMeetingsFromAgenda.ts` — Mapear `booked_at`
- `src/components/sdr/SdrLeadsTable.tsx` — Usar `scheduled_at` para horário + nova coluna "Agendado em"

