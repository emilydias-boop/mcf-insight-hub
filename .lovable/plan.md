

## Diagnóstico: Problemas nas Ligações Twilio

Analisei os logs da Edge Function, os dados reais do banco e o código frontend/backend. Encontrei **4 problemas críticos**:

### Dados reais do banco (hoje, 9 de março):

| Problema | Exemplo |
|----------|---------|
| `duration_seconds = 0` para chamadas completadas | 6 de 20 chamadas recentes |
| Chamadas presas em `in-progress` (sem `ended_at`) | 8 de 20 chamadas recentes |
| `outcome` sempre `null` (exceto quando qualificado manualmente) | 18 de 20 |
| Webhook recebe `Duration=undefined` | 100% dos logs |

### Causa 1: Webhook não lê `DialCallDuration` (duração sempre 0)

O TwiML usa `<Dial>` com `action` callback. Nesse caso, o Twilio envia o campo `DialCallDuration` (não `CallDuration`). O webhook só lê `CallDuration`, que vem `undefined`, resultando em `duration_seconds = 0`.

**Correção em `supabase/functions/twilio-voice-webhook/index.ts`:**
- Ler `DialCallDuration` como fallback: `formData.get('DialCallDuration') || formData.get('CallDuration')`
- Ler `DialCallStatus` como fallback: `formData.get('DialCallStatus') || formData.get('CallStatus')`

### Causa 2: `hangUp()` no frontend não atualiza o banco

Quando o SDR desliga pelo browser, o `hangUp()` em `TwilioContext.tsx` faz:
```js
currentCall.disconnect();
setCallStatus('completed'); // só local!
```
Nunca grava `ended_at`, `duration_seconds` ou `status: completed` no banco. Se o webhook do Twilio falhar ou demorar, a chamada fica presa como `in-progress` para sempre.

**Correção em `src/contexts/TwilioContext.tsx`:**
- No `hangUp()` e no handler `disconnect`, atualizar o registro no banco com `status: completed`, `ended_at: now()`, e `duration_seconds` calculado a partir do timer local.

### Causa 3: Chamadas "fantasma" - call records sem webhook

O `makeCall` cria o registro com status `initiated` e `started_at = now()`. Mas se o Twilio falhar ao conectar (erro de rede, número inválido), o webhook nunca dispara e o registro fica como `initiated` sem `ended_at`.

**Correção em `src/contexts/TwilioContext.tsx`:**
- No handler `error` e `cancel`, atualizar o banco com `status: failed/canceled`, `ended_at: now()`, `duration_seconds: 0`.

### Causa 4: `started_at` sobrescrito pelo webhook

O frontend define `started_at` na criação (quando o SDR clica ligar). O webhook sobrescreve `started_at` quando status é `in-progress` (quando o lead atende). Isso é semanticamente errado - deveria haver campos separados: `started_at` (SDR ligou) vs quando o lead atendeu.

**Correção em `supabase/functions/twilio-voice-webhook/index.ts`:**
- Não sobrescrever `started_at` no status `in-progress`. A data original do clique do SDR é a correta.

### Resumo das mudanças

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/twilio-voice-webhook/index.ts` | Ler `DialCallDuration`/`DialCallStatus`; não sobrescrever `started_at` |
| `src/contexts/TwilioContext.tsx` | `hangUp()` e handlers `disconnect`/`error`/`cancel` atualizam o banco |

