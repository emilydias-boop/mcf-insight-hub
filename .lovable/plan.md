

## Reprocessar webhook da Hubla do lead João Vitor (e qualquer outro derrubado pelo trigger)

### Contexto

A Hubla **enviou** o webhook do João Vitor normalmente. O log está salvo em `hubla_webhook_logs` (id `8dace3dc-f7d3-4dda-8f2b-9aabb509078c`) com `status = error` e o payload completo em `event_data`. A correção do trigger já foi aplicada, então agora basta **reexecutar** o payload original — sem precisar do Make.

### O que será feito

#### 1. Identificar todos os webhooks que falharam pelo bug do trigger
Query em `hubla_webhook_logs`:
- `status = 'error'`
- `error_message ILIKE '%enqueue_outbound_sale_webhook%does not exist%'`
- janela: últimos 7 dias (cobre desde a migration quebrada `20260420133826`)

Esperado: pelo menos o registro do João Vitor; possivelmente outros leads A010 / Hubla que caíram no mesmo erro.

#### 2. Reprocessar via edge function `hubla-webhook-handler`
Para cada log com erro:
- Pegar `event_data` (payload original íntegro da Hubla)
- POSTar de volta para a edge function `hubla-webhook-handler` com o mesmo payload
- A função fará todo o fluxo normal:
  - inserir em `hubla_transactions` (agora passa, trigger corrigido)
  - acionar lógica de roteamento A010 → `PIPELINE INSIDE SALES`
  - criar contato + deal no CRM
  - atualizar `hubla_webhook_logs` para `status = success`
- enfileirar evento em `outbound_webhook_queue` → webhook.site

#### 3. Validar no CRM
- Buscar `anisk1216@gmail.com` em `hubla_transactions` → deve existir
- Buscar contato no `PIPELINE INSIDE SALES` → deve estar criado
- Confirmar evento em `outbound_webhook_queue` (event = `sale.created`)
- Confirmar POST chegando em `webhook.site` em até 30s

### Implementação técnica

Será criada uma edge function utilitária temporária `reprocess-failed-hubla-webhooks` (ou um script one-shot) que:

```ts
// Pseudo
const { data: failed } = await supabase
  .from('hubla_webhook_logs')
  .select('id, event_data, event_type')
  .eq('status', 'error')
  .ilike('error_message', '%enqueue_outbound_sale_webhook%does not exist%')
  .gte('created_at', '2026-04-15');

for (const log of failed) {
  await fetch(`${SUPABASE_URL}/functions/v1/hubla-webhook-handler`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(log.event_data),
  });
}
```

A função `hubla-webhook-handler` já é idempotente (usa `hubla_id` único), então não há risco de duplicação para vendas que eventualmente já tenham entrado por outro caminho.

### Resultado esperado

- João Vitor (`anisk1216@gmail.com`) entra em `hubla_transactions` com `source = hubla` e `event_type = invoice.payment_succeeded`
- Lead aparece no `PIPELINE INSIDE SALES` com classificação A010
- Qualquer outro lead derrubado pelo bug do trigger (entre 20/04 13:38 e 20/04 14:14 UTC) também é recuperado
- Evento aparece em `outbound_webhook_queue` e é entregue ao webhook.site
- A Hubla volta a ser **única fonte primária** — Make permanece apenas como redundância opcional

### Escopo

- 1 edge function utilitária nova (`reprocess-failed-hubla-webhooks`) **OU** execução direta via tool de SQL/curl pelo backend
- Zero alteração de schema
- Zero alteração de UI
- Zero alteração no fluxo de ingestão normal (já corrigido pela migration anterior)

