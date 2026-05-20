## Objetivo
Fazer o `automation-enqueue` ser disparado quando deals são **criados** ou têm o **stage alterado** pelo app, para que fluxos como "Boas-vindas" e "Confirmação R1 Agendada" funcionem para leads manuais/drag-and-drop (hoje só funciona via webhooks externos).

## Mudanças

### 1. `src/hooks/useCRMData.ts` — `useCreateCRMDeal`
Após o insert bem-sucedido (e após `generateTasksForStage`), invocar:

```ts
supabase.functions.invoke('automation-enqueue', {
  body: {
    dealId: data.id,
    contactId: data.contact_id,
    newStageId: data.stage_id,
    originId: data.origin_id,
    triggerType: 'enter',
  },
}).catch(err => console.error('[automation-enqueue] create:', err));
```

- Não bloqueia a criação se falhar (catch + console).
- Não aguarda o invoke (fire-and-forget) para não atrasar UX.

### 2. `src/hooks/useCRMData.ts` — `useUpdateCRMDeal`
Dentro do bloco `if (deal.stage_id && previousStageId !== deal.stage_id && data.origin_id)`, após `handleStageChange`, disparar **dois** invokes:

```ts
// Cancela pendências do stage antigo + fluxos de saída
supabase.functions.invoke('automation-enqueue', {
  body: {
    dealId: id,
    contactId: data.contact_id,
    newStageId: previousStageId,
    originId: data.origin_id,
    triggerType: 'exit',
  },
}).catch(err => console.error('[automation-enqueue] exit:', err));

// Enfileira fluxos do novo stage
supabase.functions.invoke('automation-enqueue', {
  body: {
    dealId: id,
    contactId: data.contact_id,
    newStageId: deal.stage_id,
    oldStageId: previousStageId,
    originId: data.origin_id,
    triggerType: 'enter',
  },
}).catch(err => console.error('[automation-enqueue] enter:', err));
```

A própria edge function já cancela pendentes em `automation_queue` para o deal antes de enfileirar novos (linhas 148-159), então não há risco de duplicação.

## Fora de escopo
- Bug do cron `meeting-reminders-cron` (`crm_deals_2.bu_origem does not exist`) — D-1/M-20 continuam fora do ar até isso ser corrigido (item separado).
- Trigger Postgres em `crm_deals` (alternativa server-side) — manter no client por enquanto, já que webhooks externos chamam direto a function.
- Mudanças em templates Twilio ou variáveis.

## Verificação
1. Criar um deal manual em `/crm/negocios` direto no stage "R1 Agendada" com telefone real.
2. Em ~30s, verificar:
   - `automation_queue` tem 1+ linhas `status='pending'` para o `deal_id`.
   - `automation_logs` (após o worker rodar) tem `status='sent'` + Twilio SID.
   - WhatsApp recebe `confirmacao_r1_incorporador`.
3. Mover o mesmo deal para outro stage → confirmar que pendências do stage anterior viram `cancelled` e novos fluxos (se houver) são enfileirados.