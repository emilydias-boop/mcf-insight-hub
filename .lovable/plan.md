# Onda 3.1 — Trigger SQL para recalcular automações em remarcações

Fix focado: quando uma reunião é remarcada (`meeting_slots` muda de horário ou um novo slot ativo aparece para o mesmo deal), os itens **pendentes** em `automation_queue` são **recalculados automaticamente** com base no novo horário — sem mudar UI, sem mudar métricas.

## Migration única

### 1. Função SQL `recalc_automation_queue_for_deal(deal_id, new_anchor_at, anchor_kind)`
Roda a mesma lógica de offset que o `automation-enqueue` faz hoje, mas em SQL puro:

- Lê todos os `automation_queue` `pending` do deal.
- Para cada um, junta com `automation_steps` (delay_*) e `automation_flows.stage_id` → `crm_stages.stage_name`.
- Detecta âncora pelo `stage_name` usando os mesmos padrões regex da Onda 3 (`reuniao agendada` → `meeting_start/before`, `reuniao realizada` → `meeting_end/after`, etc.).
- **Só recalcula** se a âncora detectada for `meeting_start` ou `meeting_end` e bater com `anchor_kind` recebido.
- Calcula `new_scheduled_at = new_anchor_at ± delay_total`.
- Se `new_scheduled_at < now() + 15 min` → `UPDATE status='skipped', error_message='reschedule_too_close'`.
- Senão → `UPDATE scheduled_at = new_scheduled_at`.

### 2. Trigger `trg_meeting_slots_reschedule_recalc`
Em `meeting_slots`, `AFTER INSERT OR UPDATE`:

```text
CASO A — INSERT de novo slot ativo:
  se NEW.status NOT IN ('cancelled','no_show','rescheduled')
  e existe slot anterior do mesmo deal_id agora com status='rescheduled'
    → chama recalc com NEW.scheduled_at (kind=meeting_start)
    → e NEW.scheduled_at + duration (kind=meeting_end)

CASO B — UPDATE com mudança de scheduled_at:
  se OLD.scheduled_at <> NEW.scheduled_at
  e NEW.status NOT IN ('cancelled','no_show','rescheduled')
    → chama recalc com NEW.scheduled_at e NEW.scheduled_at+duration

CASO C — UPDATE de status para cancelled/no_show/rescheduled:
  → não faz nada aqui (o processor já cancela no T+0; e a salvaguarda do Onda 3 cobre)
```

### 3. Garantias / segurança
- Função marcada `SECURITY DEFINER` com `SET search_path = public` (lint-safe).
- Apenas `UPDATE` em `automation_queue` (status: pending → pending/skipped). Nunca cria nem apaga linha.
- **Não toca** em `meeting_slots`, `crm_deals`, `calls`, `meeting_slot_attendees` → zero impacto em métricas.
- Idempotente: rodar 2× com mesmo input dá mesmo resultado.

## Validação manual após deploy
1. Deal com flow ativo no stage `R1 Agendada`, 1 pendente agendado p/ 1h antes da reunião.
2. Remarcar a reunião pra +24h via UI normal de agenda.
3. Conferir: linha em `automation_queue` deve ter `scheduled_at` = novo horário − 1h.
4. Remarcar pra daqui a 5 min (menos que min_lead_time): linha deve virar `status='skipped', error_message='reschedule_too_close'`.
5. Marcar reunião como `no_show`: linha continua `pending` mas o processor cancela no T+0 (já coberto pela Onda 3).
6. Conferir que `meeting_slots`, `crm_deals` e dashboards de SDR/Closer não mudaram nenhum valor.

## Casos cobertos depois deste fix

| Cenário | Comportamento |
|---|---|
| Remarcação para horário futuro normal | Lembrete recalculado pro novo horário, automaticamente. |
| Remarcação pra muito em cima da hora (< 15 min antes do envio) | Lembrete cancelado (skipped). |
| No-show | Stage muda → enqueue troca de flow. Salvaguarda no processor. |
| Cancelamento sem mudança de stage | Salvaguarda do processor cancela no T+0. |
| Múltiplas remarcações seguidas | Cada uma redispara o recalc; sempre converge pro slot ativo mais recente. |

## Fora de escopo
- Mudança de UI (zero).
- Substituir `meeting-reminders-cron` (Onda 5).
- Tabela `automation_routing_rules` (vazia, Onda 4+).