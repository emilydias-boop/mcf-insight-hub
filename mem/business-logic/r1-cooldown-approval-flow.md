---
name: R1 Cooldown Approval Flow
description: SDR/Closer não pode reagendar R1 num lead que já teve R1 nos últimos N dias (default 30); pede aprovação de admin/manager/coordenador.
type: feature
---
- Regra configurável em `process_rules` com `rule_key='r1_cooldown_days'` (default 30, global, SDR+Closer). Vazio/0 = desativado. Editável em `/admin/regras-processo`.
- Helper SQL `public.has_recent_r1(_deal_id uuid, _days int) returns timestamptz` consulta `meeting_slot_attendees`+`meeting_slots` (meeting_type='r1', status ≠ cancelled/rescheduled) na janela ±N dias.
- Edge function `calendly-create-event` aplica o guard **depois** dos guards 1/2/3, **só para R1**, exceto Consórcio/Outside. Admin/manager/coordenador passam direto. Reagendamento do MESMO attendee (mesmo `parentAttendeeId` e mesmo `scheduled_at` da última R1) não dispara.
- Erro de bloqueio: `error='deal_r1_cooldown_active'` com `last_r1_at` e `cooldown_days` no payload.
- UI: `useAgendaData.useCreateMeeting` propaga `error.code` + `error.extra`; `QuickScheduleModal` abre o `RequestR1ApprovalDialog` com `ruleKey='r1_cooldown_bypass'`.
- `useCreateR1ForceRequest` aceita `ruleKey` e `extra` (dedup respeitando `rule_key`). Pedido inserido em `rule_approval_requests` com `rule_key='r1_cooldown_bypass'`.
- Aprovação: `useReviewApprovalRequest` chama `calendly-create-event` com `forceFromRequestId`; a edge function aceita ambos `r1_force_paid_lead` e `r1_cooldown_bypass`, pula os guards de paid/won **e** o cooldown (via `approvedRequest` truthy).
- R1 criada via aprovação conta normalmente em todas as métricas (KPI Agendamentos, no-show cap, Team Meetings KPI Matrix).
