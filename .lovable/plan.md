## Contexto

Vendas de Contrato Pago falham no outbound `notify-mcf-pay` com `skipped_no_codes` porque a função `resolveCodesForDeal()` só lê `r1_closer_email`, `r2_closer_email`, `original_sdr_email` e `owner_profile_id` do deal — que nesses casos estão nulos. Mas o SDR **agendou a reunião no calendário do Closer**, então os dados existem em `meeting_slot_attendees.booked_by` (SDR) e `meeting_slots.assigned_closer_id` (Closer).

Correção isolada ao edge function `notify-mcf-pay` — sem alterar tabelas, RPCs, painéis ou relatórios.

## Correção

### 1. Estender `resolveCodesForDeal()` em `supabase/functions/notify-mcf-pay/index.ts`

**Closer code** — primeiro código encontrado vence:
1. `deals.r2_closer_email` → `profiles.mcf_pay_closer_code` (atual)
2. `deals.r1_closer_email` → `profiles.mcf_pay_closer_code` (atual)
3. **NOVO** — `meeting_slots.assigned_closer_id` do R2 mais recente do deal → `closers.profile_id` → `profiles.mcf_pay_closer_code`
4. **NOVO** — mesmo caminho para R1 mais recente
5. `deals.owner_profile_id` → `profiles.mcf_pay_closer_code` (atual)

**SDR code** — primeiro código encontrado vence:
1. `deals.original_sdr_email` → `profiles.mcf_pay_sdr_code` (atual)
2. **NOVO** — `meeting_slot_attendees.booked_by` do attendee mais recente do deal → `profiles.mcf_pay_sdr_code`
3. **NOVO** — `deals.owner_profile_id` → `profiles.mcf_pay_sdr_code`

Consulta única por deal com join `meeting_slot_attendees` → `meeting_slots` filtrando por `deal_id`, ordenado por `starts_at DESC`.

### 2. Logs mais úteis

Substituir `skipped_no_codes` genérico por:
- `skipped_no_codes:closer_missing` / `sdr_missing` / `both_missing`
- Incluir no payload de log quais fontes foram tentadas (`tried: ['r2_email','r1_email','slot_assigned_closer','owner']`).

### 3. Reprocessar falhas recentes

Após deploy, reprocessar deals com `status='skipped_no_codes'` dos últimos 30 dias em `mcf_pay_dispatch_logs`, chamando `notify-mcf-pay` com `{ deal_id, source: 'backfill_agenda_attribution', force: true }`. Validar que viram `success` com `closer_code`/`sdr_code` no payload.

## Fora do escopo

- Nenhuma alteração em tabelas, RPCs, migrações ou UI.
- Nenhum impacto em painéis (SDR/Closer, Reuniões de Equipe, Fechamento, Consórcio) ou relatórios.
- Não preenche retroativamente `r1_closer_email`/`original_sdr_email` nos deals.
- Não altera inbound MCF Pay → CRM (funciona).

## Detalhes técnicos

- Arquivo único: `supabase/functions/notify-mcf-pay/index.ts`.
- Sem migração — usa colunas existentes (`meeting_slot_attendees.booked_by`, `meeting_slots.assigned_closer_id`, `closers.profile_id`, `profiles.mcf_pay_*_code`).
- Segue a hierarquia `sdr-attribution-hierarchy-v4`.
- Validação: 6 deals atuais em falha (Antonio Jailson, Filipe Palheta, Luiz Fabrício, Maria Eliane, Ariana Bordin, ADILSON) devem virar `status='success'` em `mcf_pay_dispatch_logs`.
