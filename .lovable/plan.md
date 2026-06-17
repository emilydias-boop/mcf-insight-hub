
# Recuperação de Órfãos Kiwify + Investigação de Deals Sem Ingestão

Objetivo: fechar o gap restante do dia 16-17/06 — criar deals para os 2 órfãos (`mjosedanielmoreira@gmail.com`, `weltonoliveira421@gmail.com`) e diagnosticar por que 9 deals A010 foram criados em 16/06 sem aparecer em `hubla_transactions`.

---

## Parte 1 — Recuperar 2 órfãos

Estado atual (confirmado em `hubla_transactions`):

| email | hubla_id | sale_date | linked_deal_id | Tem contact? | Tem deal? |
|---|---|---|---|---|---|
| mjosedanielmoreira@gmail.com | kiwify_ce5621a7… | 17/06 02:38 | null | não | não |
| weltonoliveira421@gmail.com | kiwify_fc5c0583… | 17/06 17:27 | null | não (só txn Hubla 2025-10) | não |

Ambos foram ingeridos como `source='kiwify'`, `sale_status='completed'`, `product_code=1475bb20-12e7-11ef-9e36-f58d9f9c7ab9` (A010), mas o `kiwify-webhook-handler` não criou contact/deal — provavelmente porque caiu no branch de "dados ausentes" (sem `customer_phone` válido) ou falha silenciosa.

### Ação 1.1 — Reuso do edge function `backfill-orphan-a010-deals`

Já existe a função `supabase/functions/backfill-orphan-a010-deals/index.ts` que faz exatamente isso via RPC `get_a010_orphan_emails`. Investigar se ela cobre o caso (provavelmente não, pois ela depende de existir um `crm_contact` órfão; aqui não há nem contato).

### Ação 1.2 — Nova edge function `kiwify-recover-orphan-transactions`

Criar função enxuta que, para uma lista de `hubla_id` (ou range de datas + `source='kiwify'` + `linked_deal_id IS NULL` + `sale_status='completed'`):

1. Lê a linha de `hubla_transactions`.
2. Procura/cria `crm_contact` por `lower(customer_email)` (e fallback por phone normalizado se houver) — respeitando a memória **CRM Manual Entry Deduplication**.
3. Verifica `PARTNER_PATTERNS` no histórico — pula se for parceiro (memória **Partner Status Exclusion**).
4. Chama RPC `get_next_lead_owner` para distribuir.
5. Insere `crm_deals` no pipeline INSIDE SALES com `tags = ['A010','A010 Kiwify']`, `origin_id` correto, `contract_paid_at = sale_date` se aplicável.
6. Insere `deal_activities` (owner-change + "criado via recovery").
7. Atualiza `hubla_transactions.linked_deal_id = deal.id`, `linked_method = 'recovery'`, `linked_at = now()`.
8. Suporta `dry_run`, `hubla_ids` (lista) ou `since/until`.

### Ação 1.3 — Execução

1. `dry_run=true` apenas para os 2 hubla_ids específicos → conferir saída.
2. `dry_run=false` mesmos 2 ids → cria os 2 deals.
3. Query de verificação: confirmar que ambos aparecem em `crm_deals` com tag A010, e `linked_deal_id` preenchido em `hubla_transactions`.

---

## Parte 2 — Investigar 9 deals A010 de 16/06 sem ingestão Kiwify

Os candidatos identificados (deals 16/06 com `kiwify_txn_count = 0`):

- `leorassi@gmail.com`, `willian@flashimpressaodigital.com.br`, `dioney.vitor020@gmail.com`, `rodrigobragacompras@yahoo.com.br`, `asantoseng@outlook.com`, `nathanoliveiro89@gmail.com`, `fco.lemos@hotmail.com`, `rodrigoribeiro.rlr@gmail.com`, `luizdavi@vitallisimagens.com.br`, `fernandodelimanp@gmail.com`, `jeison.wrs@hotmail.com`, `edilsonpalacio@yahoo.com.br` (e potencialmente mais — query truncada).

Note: vários têm tag "A010 Hubla" (não Kiwify) — vieram pela origem antiga, não pelo webhook Kiwify. Os realmente "sem ingestão Kiwify mas com tag Kiwify" são os ~3 que se destacam: `dioney.vitor020`, `rodrigoribeiro.rlr` (`any_txn_count = 0`).

### Ação 2.1 — Query diagnóstica completa

Listar todos os deals A010 de 16/06 com colunas:
- `email`, `created_at`, `tags`, `owner_id`, `created_by`, `contract_paid_at`
- `kiwify_txn_count`, `hubla_txn_count` (separados)
- `webhook_events` que mencionem o email em 16-17/06 (varredura em `event_data::text ilike '%email%'`)
- `hubla_webhook_logs` matching

Exporta CSV para `/mnt/documents/2026-06-17-deals-sem-ingestao-kiwify.csv`.

### Ação 2.2 — Classificação por causa raiz

Cada linha cai em uma das categorias:
1. **Veio só por Hubla (não Kiwify)** — tag "A010 Hubla", `hubla_txn_count > 0`. Não é problema do webhook Kiwify, é classificação correta.
2. **Webhook Kiwify chegou mas falhou** — existe entrada em `webhook_events` com `status='error'` ou em logs com erro. Ação: reprocessar.
3. **Webhook Kiwify nunca chegou** — sem trace em `webhook_events`. Ação: deal foi criado manualmente / por outra rota (replicação cross-pipeline, importação CSV). Verificar `deal_activities` do deal para descobrir origem.
4. **Email divergente** — Kiwify enviou com email diferente do CRM (typo, normalização). Buscar `hubla_transactions` 16/06 com nome similar.

### Ação 2.3 — Documento QA `docs/qa/2026-06-17-deals-sem-ingestao-kiwify.md`

Para cada um dos casos: causa raiz, evidência (logs/timestamps), ação tomada ou recomendação.

### Ação 2.4 — Correção dos casos categoria 2 (webhook falhou)

Para cada `webhook_events` com status error em 16/06 do `kiwify-webhook-handler`: usar `useReprocessWebhook` ou invocar diretamente o handler com o payload original. Validar que `hubla_transactions` foi criada e `linked_deal_id` preenchido (já corrigido pelo patch anterior).

---

## Parte 3 — Verificação final

1. Re-rodar `get_all_hubla_transactions` para 16/06 e 17/06 → confirmar contagem esperada (32 em 16/06, +2 em 17/06).
2. Query: `hubla_transactions` com `source='kiwify'`, `sale_status='completed'`, `linked_deal_id IS NULL`, `created_at >= '2026-06-01'` → deve voltar 0.
3. Adicionar verificações ao QA doc final.

---

## Detalhes técnicos

- Function nova: `supabase/functions/kiwify-recover-orphan-transactions/index.ts` (CORS, JWT manual, `service_role` interno, params Zod-validated: `dry_run`, `hubla_ids?`, `since?`, `until?`).
- Sem migration necessária; reuso de `crm_contacts`, `crm_deals`, `deal_activities`, `hubla_transactions`.
- Sem alteração de UI.
- A correção do handler Kiwify (link de `linked_deal_id`) já está aplicada — esta etapa cobre apenas o backlog e o diagnóstico residual.

## Fora de escopo

- Alerta automático "venda paga sem deal" (próxima iteração).
- Refatoração do branch "dados ausentes" no `kiwify-webhook-handler` para tentar criar contact mesmo sem phone (avaliar após classificação dos 9 deals).
