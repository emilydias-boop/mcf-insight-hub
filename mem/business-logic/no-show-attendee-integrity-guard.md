---
name: No-Show Attendee Integrity Guard
description: Em slots multi-lead, no-show exige seleção explícita do attendee; edge function valida attendee_id↔slot↔phone.
type: feature
---
**Frontend (`AgendaMeetingDrawer.tsx`)**: `selectedParticipant` só faz fallback para `participants[0]` quando há **1 único** participante no slot. Em slots multi-lead, sem seleção explícita os botões de status ficam ocultos e um aviso amarelo instrui o usuário a clicar no participante.

**Backend (`validate-no-show-evidence`)**: na ação `commit`, valida obrigatoriamente que o `attendee_id` recebido (a) existe, (b) pertence ao `meeting_slot_id` enviado, (c) seu `attendee_phone` bate (normalizado) com o `lead_phone` enviado. Qualquer divergência → 400.

**Por que existe**: bug histórico (caso Cicera/Wilza, 30/04/2026) onde o fallback silencioso fez a Julia marcar no-show no lead da Mayara, gravando print da Wilza com telefone da Cicera. IA detectou divergência mas não bloqueou.
