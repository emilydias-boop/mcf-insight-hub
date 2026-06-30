## Diagnóstico

Revisei `supabase/functions/mcf-pay-callback/index.ts` e a implementação está correta segundo a spec do MCF Pay:

- Usa `await req.text()` cru (não faz parse + stringify antes do HMAC).
- Calcula `HMAC-SHA256` com `MCF_PAY_CALLBACK_SECRET`.
- Converte para **hex minúsculo**.
- Compara com `x-mcf-pay-signature` em lowercase, aceitando prefixo `sha256=`.
- Comparação em tempo constante.

Ou seja, o problema quase certamente é **divergência do segredo** entre os dois projetos. Tem dois indícios:

1. Existem **dois** segredos parecidos no projeto: `MCF_PAY_CALLBACK_SECRET` (usado pelo callback inbound) e `MCF_PAY_WEBHOOK_SECRET` (usado no envio outbound). É fácil ter colado o valor errado em um dos lados.
2. Os logs do edge function estão vazios desde o último deploy — significa que ou o MCF Pay não está nem chegando aqui, ou já caiu antes (CORS/URL). Precisamos confirmar via banco se há registros `direction='inbound'` com `error_message='invalid_signature'`.

## Plano

1. **Confirmar no banco** os logs inbound recentes:
   ```sql
   select created_at, status, http_status, error_message, signature_preview
   from mcf_pay_dispatch_logs
   where direction = 'inbound'
   order by created_at desc
   limit 20;
   ```
   - Se aparecer `invalid_signature` → secret divergente, segue passo 2.
   - Se não aparecer nada → MCF Pay não está chegando; problema de URL/rede (fora do escopo deste plano).

2. **Sincronizar o segredo** entre CRM e MCF Pay:
   - Rotacionar `MCF_PAY_CALLBACK_SECRET` no CRM via `secrets--generate_secret` (64 chars) **OU** revelar o atual via uma edge function temporária `get-mcf-pay-callback-secret` (segue padrão da `get-crm-webhook-secret` que vocês já têm no MCF Pay).
   - Mostrar o valor uma única vez na tela `/admin/integracao-mcf-pay` (nova aba "Segredo") para o usuário copiar e colar no MCF Pay.

3. **Melhorar telemetria** em `supabase/functions/mcf-pay-callback/index.ts` para o caso de invalid_signature, sem vazar o segredo:
   - Gravar no log: `provided_preview` (primeiros 16 chars), `expected_preview` (primeiros 16 chars), `body_length`, `content_type`, hash do segredo (primeiros 8 chars de SHA-256 do secret) — assim dá pra confirmar visualmente que CRM e MCF Pay estão usando a mesma chave sem expor o valor.
   - Adicionar aba "Recebidos" em `/admin/integracao-mcf-pay` mostrando esses logs inbound (hoje a tela só mostra os 20 mais recentes sem filtrar direção).

4. **Reprocessar manualmente** as 3 vendas pendentes: após o MCF Pay voltar a entregar com 200, o próprio MCF Pay reenvia (5min/30min/2h). Se quiser forçar agora, adicionar botão "Solicitar reenvio ao MCF Pay" na tela do CRM que chama uma rota no MCF Pay (precisa endpoint do lado deles) — opcional, não bloqueante.

## Detalhe técnico

Mudanças concentradas em:
- `supabase/functions/mcf-pay-callback/index.ts` — telemetria de debug em falhas de assinatura.
- `src/pages/admin/IntegracaoMcfPay.tsx` — aba "Recebidos" com filtro `direction='inbound'` e exibição de `signature_preview`, `error_message`, payload.
- Eventualmente nova edge function `reveal-mcf-pay-callback-secret` (admin-only, retorna o secret atual mascarado/completo) — só se você preferir não rotacionar.

## Pergunta antes de implementar

Prefere **(A) rotacionar** o `MCF_PAY_CALLBACK_SECRET` agora (gero novo de 64 chars e exibo uma vez pra você colar no MCF Pay) ou **(B) revelar** o segredo atual via tela admin para conferir contra o que está cadastrado no MCF Pay?
