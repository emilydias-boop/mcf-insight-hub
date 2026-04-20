

## Adicionar `sale.created` ao webhook "Vendas Gestão - Dash Grima"

### Diagnóstico confirmado

A venda do João Vitor foi inserida em `hubla_transactions` corretamente (id `5aa224dc...`, `sale_status = completed`, `source = hubla`, `product_category = a010`). O trigger `enqueue_outbound_sale_webhook` rodou e gerou o evento `sale.created`.

Mas a **única config de webhook de saída ativa** ("Vendas Gestão - Dash Grima") tem:

```
events = ['sale.updated', 'sale.refunded']
```

`sale.created` **não está na lista**, então o trigger filtra e nada vai para o `outbound_webhook_queue` → nada chega ao webhook.site.

Isso explica também por que `success_count` e `error_count` estão zerados: nenhuma venda real chegou a ser despachada — só os 3 testes manuais que aparecem no print de Logs (eventos `test.ping` enviados pela função `outbound-webhook-test`, que ignora o filtro de events).

### Correção

Adicionar `sale.created` ao array `events` da config existente. UPDATE de uma linha:

```sql
UPDATE public.outbound_webhook_configs
SET events = ARRAY['sale.created', 'sale.updated', 'sale.refunded']
WHERE id = '05222b24-ff4f-484b-b2e1-720afe8a52ae';
```

### Reprocessar a venda do João Vitor

Como o trigger só dispara em INSERT/UPDATE, e a venda já está inserida, será necessário forçar uma reentrada na fila. Duas opções:

**Opção A (recomendada)** — `UPDATE` no-op que dispara o trigger e gera `sale.updated`:
```sql
UPDATE public.hubla_transactions
SET sale_status = sale_status
WHERE id IN ('5aa224dc-07cd-498c-9309-f6a2c8a96044','65419d04-5e1e-47cb-a92c-787d7461ce91');
```
Isso não funciona porque o trigger exige uma diferença real (`IS DISTINCT FROM`). Será feito um update neutro mais explícito (ex: tocar `gross_override` para o mesmo valor não funciona; alternativa: rebote `sale_status` paid→completed→completed). 

**Opção B (mais simples e segura)** — INSERT direto na fila com o payload já gerado pela função `build_sale_webhook_payload`:
```sql
INSERT INTO public.outbound_webhook_queue (config_id, event, transaction_id, payload)
SELECT 
  '05222b24-ff4f-484b-b2e1-720afe8a52ae',
  'sale.created',
  t.id,
  public.build_sale_webhook_payload(t, 'sale.created')
FROM public.hubla_transactions t
WHERE t.id IN (
  '5aa224dc-07cd-498c-9309-f6a2c8a96044',
  '65419d04-5e1e-47cb-a92c-787d7461ce91'
);
```

A opção B será usada — é determinística e não depende de quirks de `IS DISTINCT FROM`.

### O que será executado

Uma migration única com:

1. `UPDATE outbound_webhook_configs` — adicionar `sale.created` ao array `events`
2. `INSERT INTO outbound_webhook_queue` — enfileirar manualmente as 2 linhas do João Vitor para envio imediato

### Validação após execução

1. Verificar `outbound_webhook_queue` → 2 novas linhas com `status = pending`, `event = sale.created`
2. Aguardar até 30s (próxima execução do `outbound-webhook-dispatcher`)
3. Verificar `webhook.site` → deve receber 2 POSTs com payload completo da venda do João Vitor
4. Verificar `outbound_webhook_logs` → 2 novas linhas com `success = true`, `response_status = 200`
5. Verificar card "Vendas Gestão - Dash Grima" → contador "Sucessos" passa de 0 para 2
6. Para a próxima venda real (qualquer A010/Hubla nova), o webhook deve disparar automaticamente sem nenhuma intervenção

### Escopo

- 1 migration (UPDATE config + INSERT 2 itens na fila)
- Zero alteração de código (frontend, edge function ou trigger)
- Zero alteração de schema
- Efeito imediato — primeira execução do dispatcher cron despacha em até 30s

