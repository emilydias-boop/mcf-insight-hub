---
name: R1 Force Paid Lead Approval Flow
description: Fluxo de aprovação para SDR/Closer reagendar R1 em lead que já tem contrato pago/won — admin/manager/coordenador + Jessica Bellini aprovam.
type: feature
---
- SDR/Closer tenta agendar R1 em lead pago → guards `deal_already_paid`/`deal_already_won` em `calendly-create-event` retornam erro.
- `useCreateMeeting` (src/hooks/useAgendaData.ts) detecta esses erros e cria automaticamente uma linha em `rule_approval_requests` com `rule_key = 'r1_force_paid_lead'` e payload contendo todos os parâmetros para recriar a R1 (closer_id, scheduled_at, duration, lead_type, notes, etc.).
- Aprovadores: admin, manager, coordenador OU Jessica Bellini (email allowlist `jessica.bellini@minhacasafinanciada.com`), via função SECURITY DEFINER `public.is_r1_force_approver(uuid)`.
- UI do aprovador: aba "Aprovações Pendentes" em `/admin/regras-processo` (mesma infra do reschedule_approval_threshold).
- Ao aprovar, `useReviewApprovalRequest` invoca `calendly-create-event` com `forceFromRequestId=<id>`. A edge function:
  1. Valida JWT + chama RPC `is_r1_force_approver`.
  2. Carrega o request, exige `status='pending'` e `rule_key='r1_force_paid_lead'`, valida `target_deal_id`.
  3. **Pula apenas** os guards `deal_already_won` e `deal_already_paid`. Mantém `duplicate_active_booking` ativo.
  4. Cria a R1 pelo caminho normal de reagendamento — **conta em todas as métricas** (KPI Agendamentos, Team Meetings KPI Matrix, no-show cap).
  5. Marca request como `approved` + insere `deal_activities` `r1_force_approved` para auditoria.
- Stage do deal NÃO é rebaixado (permanece "Contrato Pago"), então cross-pipeline replication não dispara novamente.
- Sem efeito em dados históricos: attendees, transações Hubla, payouts, comissões e métricas existentes ficam intactos.
- Rejeição: fluxo normal (UPDATE status='rejected'), sem chamar edge function.
