---
name: No-Show evidence visibility and reopen flow
description: Visibilidade das evidências de No-Show para SDR/Closer, gestor e fluxo de reenvio quando rejeitada.
type: feature
---
- Tela `/crm/meus-no-shows` (e `/<bu>/crm/meus-no-shows`) lista todas as evidências enviadas pelo usuário logado (filtradas por `performed_by = auth.uid()`), independente do status.
- Tela `/crm/revisao-no-shows` (admin/manager/coordenador) mostra TODAS as evidências do sistema com filtros por status; aprovar/rejeitar aparece só para `manager_review_status = 'pending'`.
- Trigger `notify_no_show_review_decision` no `no_show_validations`:
  - Cria notificação em `user_notifications` para `performed_by` quando `manager_review_status` muda para approved/rejected.
  - Quando REJEITADO, restaura `meeting_attendees.status` de 'no_show' para 'invited' (libera SDR para reenviar com novo print).
- Componente `LeadNoShowEvidenceHistory` plugado nos drawers R1 e R2 (filtrado por dealId) — mostra o próprio histórico ao abrir o card.
- O dialog `NoShowEvidenceDialog` envia `prior_verdict` no commit; a edge function usa esse veredicto para validações (estabilidade) e re-grava o veredicto fresco apenas em `ai_verdict` para auditoria.
