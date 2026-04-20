

## Webhook de Saída — Vendas (Hubla / Kiwify / MCFPay)

Vou criar um webhook **outbound** que dispara para uma URL externa toda vez que uma venda real é registrada/atualizada na `hubla_transactions`, e centralizar o gerenciamento dos webhooks (entrada e saída) dentro de **Administração → Automações** em duas novas abas.

### O que será entregue

**1. Webhook de saída de vendas (POST)**

Dispara para a URL configurada quando:
- Uma transação é inserida em `hubla_transactions` com `source IN ('hubla','kiwify','mcfpay','make','asaas','manual')` e `sale_status IN ('paid','approved','completed','active')`.
- Ignora registros não-venda: `refunded`, `chargeback`, `audit_correction`, `manual_fix`.
- Suporta também o evento `sale.refunded` separadamente (opcional via configuração).

Payload enviado (JSON):
```json
{
  "event": "sale.created",
  "occurred_at": "2026-04-20T13:10:00-03:00",
  "transaction_id": "uuid",
  "source": "hubla|kiwify|mcfpay|make|asaas|manual",
  "external_id": "hubla_id ou similar",
  "product": {
    "name": "A010 - Consultoria...",
    "category": "a010",
    "code": "A010",
    "offer_name": "...",
    "offer_id": "..."
  },
  "values": {
    "gross_system": 47.00,        // product_price
    "gross_product": 47.00,       // reference_price (preço de tabela)
    "gross_override": null,       // se houver ajuste manual
    "net": 41.32,                 // net_value
    "currency": "BRL"
  },
  "payment": {
    "method": "credit_card|pix|boleto|...",
    "installment_number": 1,
    "total_installments": 1,
    "is_recurring": false,        // true quando installment_number > 1 OU total_installments > 1
    "is_first_installment": true
  },
  "customer": {
    "name": "...",
    "email": "...",
    "phone": "...",
    "cpf": null                   // se disponível em raw_data
  },
  "sale_date": "2026-04-20T09:34:00-03:00",
  "sale_status": "paid",
  "utm": { "source": "...", "medium": "...", "campaign": "...", "content": "..." }
}
```

Headers customizáveis pelo usuário (Authorization, X-API-Key, etc.).

**2. Trigger no banco**

Trigger `AFTER INSERT OR UPDATE` em `hubla_transactions` que:
- Filtra apenas vendas reais (status válidos + sources permitidas).
- Em UPDATE, dispara `sale.updated` se `net_value`, `product_price` ou `sale_status` mudaram.
- Em transição de `paid → refunded`, dispara `sale.refunded`.
- Insere job na fila `outbound_webhook_queue` (nova tabela leve).
- Edge Function `outbound-webhook-dispatcher` consome a fila a cada minuto (ou via pg_net direto), faz POST com retry (3 tentativas, backoff exponencial).

**3. Tabelas novas**

```sql
outbound_webhook_configs
  - id, name, description, url, method, headers (jsonb)
  - events (text[])  -- ['sale.created','sale.updated','sale.refunded']
  - sources (text[]) -- ['hubla','kiwify','mcfpay','make','asaas','manual'] (default: todos)
  - product_categories (text[]) -- filtro opcional por categoria
  - is_active, secret_token (para HMAC opcional)
  - success_count, error_count, last_triggered_at, last_error
  - created_at, updated_at, created_by

outbound_webhook_queue
  - id, config_id, event, payload (jsonb), attempts, status, next_retry_at
  - response_status, response_body, last_error, created_at, sent_at

outbound_webhook_logs (rolling 30 dias)
  - id, config_id, event, transaction_id, payload, response_status, response_body, duration_ms, created_at
```

RLS: somente admin/diretor podem ver/editar configs e logs.

**4. Edge Function `outbound-webhook-dispatcher`**

- Lê jobs `pending` ordenados por `next_retry_at`.
- Faz POST com headers do config + assinatura HMAC opcional (`X-Signature: sha256=...`).
- Em sucesso (2xx): marca `sent`, incrementa `success_count`, grava log.
- Em falha: incrementa `attempts`, agenda retry (1min, 5min, 30min). Após 3 falhas → `failed`.
- Cron `pg_cron` chama a função a cada 1 minuto.

**5. UI em Administração → Automações**

Reorganizar as abas atuais de Automações para incluir entrada e saída de webhooks:

```text
[Fluxos] [Cross-Pipeline] [Templates] [Webhooks Entrada] [Webhooks Saída] [Logs] [Configurações]
```

- **Webhooks Entrada** (nova aba): lista consolidada de TODOS os `webhook_endpoints` de todas as origens (Hubla, Kiwify, MCFPay, Make, Clint, Asaas, leads diretos). Filtros por origem/BU. Reaproveita `IncomingWebhookEditor` mas em modo "global" (todas as origens). Para cada endpoint exibe: nome, URL, slug, leads/eventos recebidos, último disparo, status ativo. Ações: editar, copiar URL, testar, ativar/desativar.

- **Webhooks Saída** (nova aba): lista de `outbound_webhook_configs`. Cada item exibe nome, URL de destino, eventos, sources filtradas, contadores de sucesso/erro, último disparo, último erro. Ações:
  - Criar/editar (dialog com URL, método, headers, eventos checkboxes, filtro de sources/categorias, secret HMAC, ativo/inativo)
  - Testar (envia payload de exemplo)
  - Ver logs (drawer com últimos 100 disparos: status code, payload, response, duração)
  - Excluir
  - Ativar/desativar

### Arquivos a criar/editar

**Backend (migration + edge function):**
- Migration: tabelas `outbound_webhook_configs`, `outbound_webhook_queue`, `outbound_webhook_logs` + RLS + trigger em `hubla_transactions` + cron pg_cron.
- `supabase/functions/outbound-webhook-dispatcher/index.ts` (consome fila e envia HTTP).
- `supabase/functions/outbound-webhook-test/index.ts` (envia payload de teste sob demanda).

**Frontend:**
- `src/hooks/useOutboundWebhooks.ts` — CRUD + logs + teste.
- `src/components/automations/OutboundWebhookList.tsx` — lista de webhooks de saída.
- `src/components/automations/OutboundWebhookFormDialog.tsx` — formulário de criação/edição.
- `src/components/automations/OutboundWebhookLogsDrawer.tsx` — visualização de logs por webhook.
- `src/components/automations/IncomingWebhooksGlobalList.tsx` — lista global de webhooks de entrada (agrupado por origem).
- Editar `src/pages/admin/Automacoes.tsx` — adicionar abas "Webhooks Entrada" e "Webhooks Saída".

### Considerações técnicas

- **Distinguir Recorrente**: regra atual usada no sistema (`installment_number > 1` ou produto com flag de recorrência). Vou usar a função existente `get_first_transaction_ids` como referência para marcar `is_recurring` corretamente no payload.
- **CPF**: vem dentro de `raw_data` quando o gateway envia (Hubla/Asaas costumam mandar). Vou extrair via JSONB path.
- **Idempotência**: payload inclui `transaction_id` UUID estável; o consumidor pode deduplicar.
- **Segurança**: HMAC SHA-256 opcional por webhook, com secret gerado no momento da criação e exibido apenas uma vez.
- **Retry**: 3 tentativas com backoff (1min, 5min, 30min). Depois disso fica em `failed` e aparece nos logs com botão "Reprocessar".
- **Performance**: trigger é leve (só faz INSERT na fila, sem chamar HTTP). O dispatcher roda a cada 1min e processa em batch.

### Escopo

- 1 migration (tabelas + trigger + cron)
- 2 edge functions (dispatcher + teste)
- 6 arquivos frontend novos
- 1 ajuste em `Automacoes.tsx`
- Zero impacto em vendas existentes ou na UI atual de vendas

