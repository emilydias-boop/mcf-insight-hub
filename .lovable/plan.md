## Objetivo

Quando o usuário clicar em **"Vincular"** no diálogo de vinculação de contrato (fluxo manual usado quando a compra Hubla não veio atrelada ao deal), o sistema deve — após marcar o attendee como `contract_paid` — reenviar automaticamente o webhook ao MCF Pay para que a comissão do SDR e do Closer seja atribuída corretamente.

## Contexto encontrado

- Botão "Vincular" fica em `src/components/crm/LinkContractDialog.tsx` e chama o hook `useLinkContractToAttendee` (`src/hooks/useLinkContractToAttendee.ts`), que já: vincula a transação Hubla, marca o attendee como `contract_paid`, move o deal para o stage "Contrato Pago".
- Já existe a edge function `supabase/functions/notify-mcf-pay/index.ts`, que resolve `mcf_pay_closer_code` / `mcf_pay_sdr_code` a partir do deal (custom_fields, closer_email, sdr_email, owner_profile_id) e faz o POST assinado ao webhook do MCF Pay configurado em `mcf_pay_config.webhook_url`.
- A função aceita `{ deal_id, source, force }`. O flag `force: true` ignora o guard de idempotência de 24h — necessário aqui porque vinculação manual pode acontecer após um disparo anterior sem códigos.

## Mudança

Editar **`src/hooks/useLinkContractToAttendee.ts`**:

1. Após concluir o passo 4 (mover deal para "Contrato Pago"), se houver `dealId`, invocar:
   ```ts
   supabase.functions.invoke('notify-mcf-pay', {
     body: { deal_id: dealId, source: 'manual_link_contract', force: true }
   })
   ```
2. Tratamento de erro **não bloqueante**: capturar falhas com `try/catch` e apenas `console.warn` — a vinculação em si não deve falhar caso o webhook retorne erro (a edge function já registra o log em `mcf_pay_dispatch_logs` e agenda retry).
3. Adicionar `toast.info` discreto informando "Reenviado ao MCF Pay" apenas quando `data.ok === true`; silencioso caso contrário (o log fica acessível na tela de auditoria já existente).

## Fora do escopo

- Não altero UI do LinkContractDialog nem do drawer.
- Não crio nova edge function nem migration — reaproveito `notify-mcf-pay` e a configuração `mcf_pay_config` já existente.
- Não mexo em fluxos automáticos (`sweep`, `retry_queue`) — apenas adiciono este gatilho manual.

## Validação

- Vincular um contrato pelo diálogo → verificar em `mcf_pay_dispatch_logs` uma nova linha com `source = 'manual_link_contract'` e `status = success` (ou `pending` se o webhook remoto responder `purchase_not_found_yet`).
- Confirmar no toast que a vinculação continua funcionando mesmo se `notify-mcf-pay` falhar.
