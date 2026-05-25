## Problema

A edge function `twilio-voice-twiml` está retornando **403 Forbidden** em toda chamada porque a validação de assinatura do Twilio falha (`Invalid Twilio signature` aparece em todos os logs recentes). Sem TwiML válido, o Twilio encerra a ligação e o softphone do SDR mostra falha.

## Causa raiz

A função monta o HMAC com `req.url`, que dentro do runtime do Supabase resolve para `http://localhost:9999/...` (URL interna). O Twilio assinou a requisição usando a URL pública (`https://<project>.supabase.co/functions/v1/twilio-voice-twiml`). Como as URLs diferem, o hash nunca bate e cai sempre no `return new Response('Forbidden', { status: 403 })`.

O mesmo padrão precisa ser revisado em `twilio-voice-webhook` (action/recording/AMD callbacks) se ele também validar assinatura — pelo TwiML gerado, ele recebe callbacks do Twilio.

## Correção

Em `supabase/functions/twilio-voice-twiml/index.ts`:

1. Reconstruir a URL pública a partir dos headers de proxy antes de validar:
   - Usar `x-forwarded-proto` + `x-forwarded-host` (ou `host`) + `pathname` + `search` de `req.url`.
   - Fallback fixo para `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-voice-twiml` quando os headers não vierem.
2. Passar essa URL reconstruída para `validateTwilioSignature` no lugar de `req.url`.
3. Logar a URL usada quando a assinatura falhar (para diagnóstico futuro), sem vazar o token.
4. Conferir o mesmo problema em `twilio-voice-webhook` e aplicar a mesma correção se ele também valide assinatura.

Sem alterações de schema, secrets ou frontend — apenas a função de TwiML (e possivelmente o webhook de status).

## Verificação após o fix

- Fazer uma ligação de teste pelo softphone.
- Conferir nos logs de `twilio-voice-twiml` que aparece `Generated TwiML for call to: ...` em vez de `Invalid Twilio signature`.
- Confirmar que a chamada toca e conecta no destino.