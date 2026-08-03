---
name: Reentrada de lead move stage do negócio existente
description: webhook-lead-receiver move deal existente da Inside Sales para "Novo Lead" (a010-kiwify/lead-guia/planilha) ou "ANAMNESE COMPLETA" (endpoints de anamnese), com 3 proteções contra regressão de cliente pago.
type: feature
---
Em `supabase/functions/webhook-lead-receiver/index.ts`, no fluxo "deal já existe" (após `check_duplicate_deal_by_identity`):

- `REENTRY_STAGE_BY_SLUG` só se aplica quando `endpoint.origin_id = e3c04f21-ba2c-4c66-84f8-b4341c826b1c` (PIPELINE INSIDE SALES / BU Incorporador).
  - `a010-kiwify`, `lead-guia`, `planilha` → Novo Lead `cf4a369c-c4a6-4299-933d-5ae3dcc39d4b`
  - `anamnese-ytb`, `anamnese-ytb-live`, `anamnese-manychat`, `ananmnese-live-insta`, `clientdata-inside`, `anamnese-mcf` → `e6fab26d-f16d-4b00-900f-ca915cbfe9d9`
  - `anamnese-insta-mcf` fica FORA (origin diferente).
- Bloqueios (`getReentryBlockReason`, curto-circuito, máx. 2 queries): stage atual = Contrato Pago `062927f5…` ou Venda realizada `3a2776e2…` (`deal_in_paid_stage`); `hubla_transactions` com `linked_deal_id` + `sale_status='completed'` + A000/contrato (`contract_payment_linked`); `meeting_slot_attendees.contract_paid_at` não nulo (`attendee_contract_paid`).
- Quando bloqueado, os dados são atualizados normalmente e a resposta traz `stage_move_skipped`. Movimentação gera `deal_activities` com `activity_type='stage_change'` e `trigger='webhook_reentry'`. Resposta inclui `stage_moved`, `new_stage_id`, `stage_move_skipped`.
- Precedência mantida: fluxo ANAMNESE-INCOMPLETA → "Lead Gratuito" (`anamnese-mcf` + tag) roda antes.
- O Kanban exibe nomes de stage de `local_pipeline_stages` (fonte da verdade em `useCRMData.fetchStages`); `crm_stages.stage_name` do id `e6fab26d…` foi corrigido de "ANAMNESE INCOMPLETA" para "ANAMNESE COMPLETA".
