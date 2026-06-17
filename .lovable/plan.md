# Recuperar vendas A010 de 16/06 e prevenir nova quebra do webhook Kiwify

## Diagnóstico definitivo (cruzando as 2 planilhas oficiais)


| Source    | Vendas reais (planilha) | Em `hubla_transactions` | Com deal no CRM | **Faltando criar** |
| --------- | ----------------------- | ----------------------- | --------------- | ------------------ |
| Hubla     | 13                      | 9                       | 9               | **4**              |
| Kiwify    | 28                      | 2                       | 1               | **27**             |
| **TOTAL** | **41**                  | 11                      | 10              | **31**             |


**Por que o kanban mostra 32 e não 41**: o filtro "Possui A010" cruza email do contato com `hubla_transactions`. Como só 10 dos 41 compradores reais têm deal, mas vários outros leads que **já tinham comprado A010 antes** receberam novo deal/movimentação em 16/06, esses entram no filtro e levam o número visível para 32.

**Causa raiz**: o webhook `kiwify-webhook-handler` está com falha grave de ingestão para 16/06 (1 de 28 = 96% de perda). O Hubla está com 31% de perda. Precisamos: (1) recuperar agora as 31 vendas perdidas e (2) investigar e corrigir o webhook Kiwify.

## Etapa 1 — Recuperar os 31 leads faltantes (one-shot)

Edge function `backfill-a010-from-spreadsheets` que:

1. Recebe `{ source: 'hubla'|'kiwify', rows: [{email, nome, telefone, cpf?, sale_date}], dry_run }`.
2. Para cada linha:
  - **Insere** em `hubla_transactions` se não existir (`hubla_id = 'sheet-backfill-<source>-<sha8(email)>'`, `source`, `product_name='A010 - Construa para Vender sem Dinheiro'`, `product_code='1475bb20-12e7-11ef-9e36-f58d9f9c7ab9'`, `product_category='a010'`, `sale_status='completed'`, `sale_date='2026-06-16'`).
  - **Reaproveita ou cria** `crm_contacts` (lookup por `lower(email)`; se phone diferente, atualiza).
  - **Reaproveita ou cria** `crm_deals` em `PIPELINE INSIDE SALES` (`origin_id='e3c04f21-ba2c-4c66-84f8-b4341c826b1c'`), respeitando regra `A010 buyers restricted strictly to PIPELINE INSIDE SALES`. Tags: `['A010', source==='kiwify' ? 'A010 Kiwify' : 'A010 Hubla']`.
  - Liga `linked_deal_id` ↔ `crm_deals.id` (igual à Fase A/B).
3. Roda o pipeline normal de distribuição de SDR (mesma função usada pelo webhook em produção) — para os deals novos só.
4. Saída: `{ created_contacts, created_deals, created_transactions, skipped_existing, errors[] }`.

**Disparo**: chamo via `supabase--curl_edge_functions` passando as 41 linhas extraídas das planilhas, primeiro `dry_run=true`, você revisa, depois `dry_run=false`.

## Etapa 2 — Investigar webhook Kiwify (por que 27/28 sumiram)

Antes de mexer no código, levanto:

1. `webhook_ingest_failures` filtrando `source='kiwify'`, dia `2026-06-16` (UTC e BRT).
2. `function_edge_logs` para `kiwify-webhook-handler` em 16/06 — contar status, erros, payload `compra_status`.
3. `hubla_webhook_logs` / `bu_webhook_logs` se algum receber Kiwify duplicado.
4. Verificar se nesses 27 emails o evento sequer chegou: `SELECT * FROM webhook_endpoints WHERE source='kiwify'` e log de recebimento.

**Resultado esperado**: identificar se é (a) Kiwify não enviou (problema no painel/URL configurada), (b) chegou mas foi rejeitado por validação, (c) inseriu em `hubla_transactions` com `sale_status≠'completed'` e por isso o link com deal não disparou.

Com base no que for, abro uma sub-etapa de correção da função em build mode (não faço palpite agora).

## Etapa 3 — Card de monitoramento "Vendas A010 sem deal" no painel

Adiciono no `WebhookIntakeAnalytics.tsx` (já criamos `IngestFailuresCard`) um segundo card:

- Query: dia atual, conta `hubla_transactions A010 completed` sem `linked_deal_id` + ranking por `source`.
- Botão "Recuperar agora" → invoca `backfill-a010-from-spreadsheets` reaplicando só essas linhas (sem precisar de planilha).

## Detalhes técnicos

- **Idempotência**: `hubla_id` único + check `EXISTS` em `crm_contacts/crm_deals` antes de criar.
- **Ordem**: contato → transação → deal → linkagem → distribuição SDR. Erro em qualquer passo retorna parcial, não rollback total — registra em `errors[]`.
- **Telefone**: normalizar com mesma função que `kiwify-webhook-handler` usa hoje (`normalizePhone`).
- `**sale_date**`: usar a data de pagamento da planilha; se ausente, `2026-06-16 12:00 BRT`.

## Fora de escopo

- Não toco em deals já existentes dos 10 que estão OK.
- Não mexo no relatório histórico; ele passará a refletir os 41 automaticamente após a ingestão.
- Cron diário (`daily-a010-reconcile`) **continua não-agendado** até você liberar.

## Confirmações que preciso de você antes de implementar

1. **Data de venda das 41 linhas**: as planilhas não trouxeram coluna de data explícita nas amostras. Posso assumir todas como `2026-06-16` (data do print)? SIM
2. **Distribuição SDR**: rodo distribuição normal nos 31 deals novos, 
3. **Etapa 2 antes ou depois da Etapa 1**: faço o backfill agora (resolve hoje) e investigo o Kiwify em paralelo, OU prefere investigar primeiro para entender o que aconteceu antes de criar massa? Verifique se ja nao a esses leads criados.