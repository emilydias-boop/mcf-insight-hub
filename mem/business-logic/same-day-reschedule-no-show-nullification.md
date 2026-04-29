---
name: Same-Day Reschedule No-Show Nullification
description: Remanejamento no mesmo dia anula no-show do slot anterior; lead segue como 1 agendamento único; histórico preservado em attendee_movement_logs.
type: feature
---

**Regra**: Quando attendee é movido para outro slot no MESMO DIA (timezone America/Sao_Paulo), o status `no_show`/`invited`/`scheduled` é automaticamente convertido em `rescheduled`. Lead conta como 1 agendamento único, desfecho final é o do slot atual.

**Triggers em `meeting_slot_attendees`**:
- `trg_reset_attendee_status_on_same_day_move` (BEFORE UPDATE OF meeting_slot_id): se old_date = new_date e status não é final, força `rescheduled` + `is_reschedule=true`.
- `trg_prevent_no_show_after_same_day_move` (BEFORE UPDATE OF status): bloqueia marcação de `no_show` se houve `same_day_reschedule` nos últimos 30min.

**Status finais preservados sempre**: `contract_paid`, `completed`, `refunded`, `approved`, `rejected`.

**Cross-day**: remanejamento para outro dia mantém o no_show original (legítimo).

**Auditoria**: `attendee_movement_logs` mantém histórico completo (previous_status, from/to slots) — métricas usam apenas o status atual do attendee.
