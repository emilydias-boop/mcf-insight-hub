## Problema

O toast mostrou `status: queued` e `SID MM65…f867`, mas o destinatário não recebeu. O Twilio só responde "queued" no momento do POST — o status real (delivered, failed, undelivered + errorCode) só chega depois, via webhook `StatusCallback`. Hoje o `automation-test-send` **não** envia `StatusCallback`, então o `automation_logs` fica congelado em `sent` e a gente não tem visibilidade.

Causas típicas pra mensagem ficar "queued" e nunca entregar (uma delas é o nosso caso):
- Template aprovado em outra categoria/idioma diferente do que o número de origem permite enviar.
- Janela de 24h fechada **e** template usado como sessão (não como template) → Twilio rejeita silenciosamente (errorCode 63016).
- Número do WhatsApp Business Sender ainda em sandbox → só entrega pra números pré-aprovados.
- Conta sem saldo / suspensa.

Pra resolver de forma definitiva precisamos **ver o errorCode do Twilio**.

## Plano

### 1. Botão "Verificar status" no diálogo de teste
`src/components/automations/TemplateTestSendDialog.tsx` — quando já existe um `result.messageSid`, mostrar botão **Verificar status agora** que chama uma nova edge function `automation-test-status?sid=...` e exibe `status`, `errorCode`, `errorMessage`, `dateUpdated`.

### 2. Nova edge function `automation-test-status`
`supabase/functions/automation-test-status/index.ts` (verify_jwt=false, valida admin/manager via `has_role`):
- Recebe `?sid=MMxxxx`
- Faz `GET https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages/{sid}.json` com Basic Auth
- Retorna `{ status, errorCode, errorMessage, dateSent, dateUpdated, to, from }`
- Atualiza `automation_logs` (status real + `error_message` + `external_status`) pro mesmo `external_id`.

### 3. StatusCallback automático no envio
Editar `automation-test-send/index.ts` (e, na sequência, `automation-processor` se aplicável) pra incluir no POST do Twilio:
```
StatusCallback = https://<project-ref>.functions.supabase.co/twilio-status-webhook
```
E criar/garantir uma edge function `twilio-status-webhook` (verify_jwt=false, pública) que:
- Recebe form-encoded `MessageSid`, `MessageStatus`, `ErrorCode`, `ErrorMessage`
- `update automation_logs set status=..., external_status=..., delivered_at/error_message=...` `where external_id = MessageSid`

Assim qualquer envio futuro (teste ou produção) atualiza o log sozinho até `delivered`/`failed`.

### 4. Diagnóstico imediato (um único clique, sem deploy)
Independente do plano acima, no momento que você aprovar eu posso primeiro só rodar a função `automation-test-status` apontando pro `MM656bff04d6e6a8b3d6111c49e7bdf867` e te mostrar o `errorCode` exato — assim a gente já sabe se é template, sandbox, opt-in ou saldo, antes de mexer em mais nada.

## Detalhes técnicos

- `supabase/config.toml`: adicionar `[functions.automation-test-status]` e `[functions.twilio-status-webhook]` com `verify_jwt = false`.
- URL do webhook: `https://rehcfgqvigfcekiipqkc.functions.supabase.co/twilio-status-webhook`.
- Não precisa migration nem novas secrets — `TWILIO_ACCOUNT_SID` e `TWILIO_AUTH_TOKEN` já existem.
- Mantém a UX atual (toast + ContentVariables); só adiciona um bloco "Status no Twilio" expansível abaixo.

## Como testar

1. Reabrir o diálogo do template **Boa Vindas** (o `messageSid` continua salvo se a sessão persistir; senão envio um novo).
2. Clicar **Verificar status agora** → ler `errorCode`/`errorMessage`.
3. Disparar um novo teste → o `StatusCallback` deve atualizar `automation_logs` em poucos segundos, visível em `/admin/automacoes` → Logs.
