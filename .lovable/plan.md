## Diagnóstico

Encontrei **dois bugs** ao tentar atualizar status:

### Bug 1 — Botão "Sincronizar status" (toast "Failed to send a request to the Edge Function")
A função `twilio-content-status-poll` (e também `twilio-content-manage`) **não está deployada** — `curl` retorna `404 NOT_FOUND`. Motivo: ambas faltam entrada `[functions.<nome>]` no `supabase/config.toml`. Outras funções como `automation-enqueue` e `twilio-whatsapp-webhook` estão registradas e funcionam normalmente.

### Bug 2 — Trigger de mudança de estágio (encontrado nos logs do automation-enqueue)
```
[AUTOMATION-ENQUEUE] Error: invalid input value for enum automation_trigger: "stage_enter"
```
Em `supabase/functions/automation-enqueue/index.ts` há:
```ts
const triggerFilter = triggerType === 'enter' ? 'stage_enter' : 'stage_exit';
flowQuery = flowQuery.eq('trigger_on', triggerFilter);
```
Mas o enum `automation_trigger` no banco tem **apenas** os valores `enter` e `exit`. Toda criação/atualização de deal está estourando esse erro silenciosamente, impedindo qualquer fluxo de WhatsApp de ser enfileirado (inclusive o teste com a Carol).

## Correções

### 1. `supabase/config.toml`
Adicionar:
```
[functions.twilio-content-manage]
verify_jwt = false

[functions.twilio-content-status-poll]
verify_jwt = false
```

### 2. `supabase/functions/automation-enqueue/index.ts`
Trocar o mapeamento errado por uso direto do valor do enum:
```ts
flowQuery = flowQuery.eq('trigger_on', triggerType); // 'enter' ou 'exit'
```
(remover a linha `const triggerFilter = ...`)

## Validação

1. Após deploy, `curl OPTIONS twilio-content-status-poll` deve retornar 200.
2. Clicar **Sincronizar status** em `/admin/automacoes` → Templates: sem toast de erro, retorna `{success:true,checked:[...]}`.
3. Mover/criar um deal: nos logs do `automation-enqueue` deve aparecer `Found N active flows` (ou `No active flows for this stage`), sem mais o erro de enum.

## Riscos

- Nenhum — mudanças isoladas em config + 1 linha de função. Não toca em schema nem em dados.
