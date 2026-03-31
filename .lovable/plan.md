

## Fix: "Agendado em" mostrando "-" para quase todos os registros

### Problema
A coluna "Agendado em" mostra "-" porque o campo `booked_at` na tabela `meeting_slot_attendees` só está preenchido em 64 de 1786 registros de março. A maioria dos attendees foi criada sem preencher `booked_at`, mas o campo `created_at` (sempre preenchido) representa o momento em que o agendamento foi feito.

### Correção

**1. Migration SQL** — Alterar ambas as versões da RPC `get_sdr_meetings_from_agenda` para usar `COALESCE(msa.booked_at, msa.created_at)::text` em vez de `msa.booked_at::text`. Isso garante que sempre haverá um valor mostrando quando o agendamento foi criado.

**2. Backfill (opcional)** — Na mesma migration, preencher `booked_at = created_at` para todos os attendees que têm `booked_at IS NULL`, evitando o problema para futuras queries diretas.

### Resultado esperado
A coluna "Agendado em" mostrará a data/hora real de quando cada reunião foi agendada pelo SDR, permitindo ao gestor ver claramente quais reuniões de hoje foram agendadas hoje vs. dias anteriores.

### Arquivos afetados
- `supabase/migrations/[new].sql` — Recriar RPCs com fallback + backfill de `booked_at`

