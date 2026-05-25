# Plano para corrigir a chamada com locução em inglês

## Diagnóstico
Os logs mostram que o problema continua no `twilio-voice-twiml`:
- a função está retornando **403 Forbidden**
- a validação de assinatura do Twilio está sendo feita contra URLs como `https://rehcfgqvigfcekiipqkc.supabase.co/twilio-voice-twiml`
- a URL pública correta do endpoint é `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-voice-twiml`

Quando o Twilio recebe esse 403, ele toca a mensagem automática em inglês — que é a “mulher falando” que você ouve.

## O que vou implementar
1. **Corrigir a reconstrução da URL assinada do Twilio**
   - Ajustar `twilio-voice-twiml` para testar também a URL pública real com `/functions/v1/...`.
   - Aplicar o mesmo ajuste em `twilio-voice-webhook`, `twilio-status-webhook` e `twilio-whatsapp-webhook` para manter o comportamento consistente.

2. **Melhorar a validação e os logs**
   - Registrar claramente qual URL externa foi aceita ou rejeitada.
   - Diferenciar erro de assinatura de erro de TwiML, para ficar óbvio nos logs se a chamada falhou antes ou depois de gerar o XML.

3. **Validar o fluxo de voz ponta a ponta**
   - Confirmar que `twilio-voice-twiml` passa a responder 200.
   - Verificar se o `twilio-voice-webhook` começa a receber os callbacks de status da chamada.
   - Confirmar que a chamada deixa de cair na locução automática em inglês.

4. **Checar o reflexo no discador**
   - Validar se, após a correção do fluxo Twilio, o clique em ligar e o discador voltam a abrir a chamada normalmente.
   - Confirmar se os registros de chamada passam a sair de `initiated/failed` incorretamente e avançam para os status reais.

## Detalhes técnicos
- Arquivos alvo:
  - `supabase/functions/twilio-voice-twiml/index.ts`
  - `supabase/functions/twilio-voice-webhook/index.ts`
  - `supabase/functions/twilio-status-webhook/index.ts`
  - `supabase/functions/twilio-whatsapp-webhook/index.ts`
- Ajuste principal:
  - incluir candidatos de URL no formato `SUPABASE_URL + /functions/v1 + pathname`
  - manter fallbacks com `host`, `x-forwarded-host` e URL interna do runtime
- Critério de sucesso:
  - sumir o erro `Invalid Twilio signature`
  - `twilio-voice-twiml` responder com TwiML válido
  - a chamada completar sem a mensagem automática em inglês