## Corrigir validação Kiwify (HMAC-SHA1) e consolidar webhook

### Diagnóstico
A Kiwify autentica webhooks via:
- Query string `?signature=<hex>` na URL
- `signature = HMAC-SHA1(rawBody, KIWIFY_WEBHOOK_TOKEN)` em hex lowercase

Nosso handler hoje compara o token de forma literal — por isso rejeita 100% dos eventos. Os 36 deals A010 de ontem vieram só pela Hubla; **nenhum** veio da Kiwify.

### Passos

1. **Garantir secret `KIWIFY_WEBHOOK_TOKEN = ebbcys9gj7d`** (via `update_secret`, formulário seguro).

2. **Reescrever validação em `supabase/functions/kiwify-webhook-handler/index.ts`:**
   - Ler `rawBody` como texto (antes de `JSON.parse`).
   - Ler `signature` da query string (`?signature=...`), com fallback para header `x-kiwify-signature`.
   - Computar `HMAC-SHA1(rawBody, KIWIFY_WEBHOOK_TOKEN)` em hex.
   - Comparar via `timingSafeEqual` (constante).
   - Se bater → processar; se não → 401.
   - Manter normalização do body (aceitar `rawBody.order` wrapped OU flat).

3. **Deploy do edge function** e testar:
   - Enviar via `curl_edge_functions` o payload `order_approved` real com `?signature=` computado localmente para validar fluxo verde.
   - Enviar com signature errado para validar 401.

4. **Validar nos logs** do `kiwify-webhook-handler`:
   - "Signature OK"
   - "Received event: order_approved"
   - Deal criado/atualizado no CRM com tag A010

5. **Após confirmação:** você desativa o endpoint `webhook-lead-receiver/a010-kiwify` no painel da Kiwify (manual) para eliminar duplicação.

### Não vou fazer
- Não vou tocar no `webhook-lead-receiver` nem em outros handlers.
- Não vou fazer backfill dos pedidos perdidos nesta etapa (proponho depois se quiser).
- Não vou alterar lógica de criação de deal A010 (já está correta).

### Resultado esperado
Webhook Kiwify aceita assinatura HMAC-SHA1 corretamente, deals A010 entram automaticamente em INSIDE SALES, fim da divergência.

Confirma para eu executar?