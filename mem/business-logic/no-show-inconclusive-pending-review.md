---
name: No-Show inconclusive requires manager approval
description: Veredictos 'inconclusive + justificativa' viram pending_review e só contam após aprovação do gestor.
type: feature
---
Em `validate-no-show-evidence` (action=commit), `effectiveVerdict === 'inconclusive'` grava `final_status='pending_review'` e `manager_review_status='pending'`. O dialog `NoShowEvidenceDialog` NÃO chama `onConfirm()` (que marca attendee no_show + move stage) quando o backend retorna `pending_review`. O no-show só é aplicado de fato quando o gestor aprova em `/crm/revisao-no-shows` via `useReviewNoShowContest`, que então atualiza `meeting_slot_attendees.status='no_show'` e roda `syncDealStageFromAgenda(deal_id, 'no_show', mtype)`.

Veredictos 'confirmed' continuam auto-aprovados; 'not_no_show' só é aceito como contestação (também pending_review).
