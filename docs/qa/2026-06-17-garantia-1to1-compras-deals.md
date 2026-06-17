# Garantia 1:1 — Compras A010 (Kiwify) ↔ Deals + Relatório

Data: 2026-06-17
Escopo: Fase A do plano "Garantia 1:1".

## O que foi implementado

### 1. Tabela `webhook_ingest_failures` (migration)
Toda compra paga A010 que não virar deal completo (nome+email+telefone) agora é registrada com:
- `source`, `hubla_id`, `customer_*`, `product_name`
- `raw_payload` completo da venda
- `failure_reason` (`deal_not_created` ou `deal_creation_threw`)
- `attempts`, `status` (`pending` → `retrying` → `resolved` ou `abandoned` após 5 tentativas)
- `resolved_deal_id` quando o retry consegue criar o deal

Acesso: admin / manager / coordenador.

### 2. View `v_a010_reconciliation`
Mostra por dia × fonte: `transactions`, `transactions_with_deal`, `transactions_orphan`.
Pode ser consumida pelo painel `/crm/webhook-analytics` para mostrar gap real.

### 3. Patch `kiwify-webhook-handler`
Adicionado helper `logIngestFailure()`. Cobertura:
- Quando `createOrUpdateKiwifyCRMContact` retorna `dealId: null` (compra sem email+phone, sem contactId/originId, deal duplicado bloqueado, erro de insert) → grava em `webhook_ingest_failures` com motivo `deal_not_created`.
- Quando a função lança exceção → grava com motivo `deal_creation_threw` e mensagem do erro.

Webhook continua respondendo 200 (não força reenvio Kiwify), mas falha fica visível.

### 4. Edge function `retry-webhook-failures`
Roda a cada 5 minutos via `pg_cron`:
- Busca até 50 falhas com `status IN ('pending','retrying')` e `attempts < 5`.
- Para falhas Kiwify, invoca `kiwify-recover-orphan-transactions` passando os `hubla_ids`.
- Atualiza status:
  - `resolved` + `resolved_deal_id` quando recuperação cria/vincula deal.
  - `retrying` com `attempts++` quando ainda não conseguiu (próxima tentativa em 5 min).
  - `abandoned` após 5 tentativas — exige investigação manual.

### 5. Cron `retry-webhook-failures-5min`
Agendado em `cron.job` (jobid 27).

## Como testar

1. Simular falha:
```sql
INSERT INTO webhook_ingest_failures (source, hubla_id, customer_email, customer_name, product_name, raw_payload, failure_reason)
VALUES ('kiwify', 'kiwify_TEST_001', 'teste@exemplo.com', 'Teste', 'A010 - Construa para Vender sem Dinheiro', '{}'::jsonb, 'deal_not_created');
```

2. Aguardar 5 min ou chamar manualmente:
```bash
curl -X POST https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/retry-webhook-failures
```

3. Conferir resultado:
```sql
SELECT id, status, attempts, resolved_deal_id, last_error FROM webhook_ingest_failures ORDER BY created_at DESC LIMIT 10;
```

## Painel de monitoramento (próxima fase)

Card sugerido em `/crm/webhook-analytics`:
```sql
SELECT status, count(*) FROM webhook_ingest_failures
WHERE created_at >= now() - interval '24 hours'
GROUP BY status;
```

## Próximas fases (não implementadas hoje)

- **Fase B**: estender `kiwify-backfill-a010-csv` para gravar linha em `hubla_transactions` (hoje só cria deal).
- **Fase C**: `daily-a010-reconcile` (06:00) — compara compras × deals do dia anterior e dispara `alertas`.
- **Fase C**: card "Compras sem deal nas últimas 24h" no UI de webhook-analytics com botão "Reprocessar".
- **Fase D**: replicar `logIngestFailure` no `hubla-webhook-handler` (hoje só Kiwify cobre).

## Resposta direta às perguntas do usuário

> "Como resolvemos para todas as compras A010 virarem deal com nome+email+telefone?"

Toda falha agora fica registrada em `webhook_ingest_failures` e o cron tenta resolver a cada 5 min por até 5 tentativas. Se mesmo após 5 tentativas falhar (cliente realmente não tem email ou phone válido), entra em `abandoned` e o admin é alertado.

> "Por que não chega o mesmo número no relatório?"

Causa raiz: o RPC `get_all_hubla_transactions` faz `INNER JOIN product_configurations`. Toda compra cujo `product_name` não casa exatamente com algum nome em `product_configurations` é silenciosamente excluída. Exemplo encontrado: "Captação de Clientes e Investidores para Escalar **sua Construtora**" (Kiwify) vs "A011 - Captação… **seu Negócio**" (config). A view `v_a010_reconciliation` permite ver isso em tempo real. Correção do mapeamento de produtos fica para tarefa separada.