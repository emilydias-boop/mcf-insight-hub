# QA — Recuperação Órfãos Kiwify + Investigação 9 Deals Sem Ingestão (17/06/2026)

Continuação de `2026-06-17-fix-kiwify-linked-deal-id.md`. Cobre os 2 órfãos residuais e os deals A010 de 16/06 que não tinham linha em `hubla_transactions` source=kiwify.

## Parte 1 — Recuperação dos 2 órfãos

### Estado inicial

| email | hubla_id | contact | deal |
|---|---|---|---|
| `mjosedanielmoreira@gmail.com` | `kiwify_ce5621a7…` | não existia | não existia |
| `weltonoliveira421@gmail.com` | `kiwify_fc5c0583…` | não existia (só txn Hubla 2025-10) | não existia |

Ambos foram ingeridos em `hubla_transactions` (`source='kiwify'`, `sale_status='completed'`, produto A010) mas o `kiwify-webhook-handler` falhou na criação de contato — provavelmente pelo trigger `duplicate_contact:phone:<suffix>` (telefone igual a contato pré-existente).

### Solução

Nova edge function `kiwify-recover-orphan-transactions` que:

1. Busca `hubla_transactions` com `source='kiwify'`, `linked_deal_id IS NULL`, `sale_status='completed'` (por `hubla_ids` ou janela `since/until`).
2. Acha contato por email; se não houver, faz fallback por sufixo de 9 dígitos do telefone (memória **CRM Manual Entry Deduplication**); se ainda não houver, insere — capturando o `duplicate_contact:phone:<suffix>:<uuid>` do trigger para reaproveitar o contato existente.
3. Aplica check **Partner Status Exclusion** (lista A001-A009, R001, INCORPORADOR, ANTICRISE).
4. Reusa deal existente na origem PIPELINE INSIDE SALES se houver; senão cria novo via `get_next_lead_owner` com tags `['A010','A010 Kiwify']` e registra `deal_activities` (owner_change).
5. Atualiza `hubla_transactions.linked_deal_id`, `linked_at`, `linked_method='manual'` (constraint só aceita `auto`/`manual`).

### Execução

- Dry-run: 2 órfãos → `would_create`.
- Run real: 2 contatos reutilizados (duplicados por phone), 2 deals novos criados, link inicialmente falhou por `linked_method='recovery'` (rejeitado pelo check). Patch aplicado para usar `manual`; link executado via UPDATE direto.

### Verificação

```sql
SELECT hubla_id, linked_deal_id, linked_method
FROM hubla_transactions
WHERE hubla_id IN ('kiwify_ce5621a7…','kiwify_fc5c0583…');
-- ambos linkados (manual, 2026-06-17 19:03Z)

SELECT count(*) FROM hubla_transactions
WHERE source='kiwify' AND sale_status='completed'
  AND linked_deal_id IS NULL AND sale_date >= '2026-06-01';
-- 0
```

Deals criados:
- `5337df93-aa0b-49ff-be4f-2e2c2226dd8c` — José Daniel
- `83f27524-6917-4064-85af-6254328acb39` — Welton

---

## Parte 2 — Investigação dos 9+ deals A010 de 16/06 sem `hubla_transactions` kiwify

Query: deals A010 criados em 16/06 sem nenhuma linha `hubla_transactions` source=kiwify casando email + data → 28 deals.

### Classificação por causa raiz

**Categoria A — Vieram via Hubla (não Kiwify)**. Tags `[A010 Hubla]` ou `[A017 Hubla A010]`. `hubla_tx > 0`. Não é problema do fluxo Kiwify — produto foi vendido pela plataforma Hubla, classificação correta.

Exemplos (10 deals): `leorassi@gmail.com`, `willian@flashimpressaodigital.com.br`, `rodrigobragacompras@yahoo.com.br`, `asantoseng@outlook.com`, `nathanoliveiro89@gmail.com`, `fco.lemos@hotmail.com`, `luizdavi@vitallisimagens.com.br`, `fernandodelimanp@gmail.com`, `jeison.wrs@hotmail.com`, `edilsonpalacio@yahoo.com.br`.

**Categoria B — Vieram pelo handler antigo `clint-webhook-handler`** (rota legada ClientData). Têm `kiwify_order_id` no custom_fields mas o handler antigo grava só em `crm_deals`, não em `hubla_transactions`. Logo, "sumiram" do dashboard Kiwify-baseado.

Exemplos (2 deals): 
- `dioney.vitor020@gmail.com` — `custom_fields.webhook_endpoint: ClientData Inside`, `kiwify_order_id: lZH69gc`, criado 00:51.
- `rodrigoribeiro.rlr@gmail.com` — idem, `kiwify_order_id: 3g7m8Dh`, criado 15:05.

Ação recomendada: rota `clint-webhook-handler` deve ser desativada ou redirecionar pra `kiwify-webhook-handler`. Fora de escopo desta tarefa — registrar em backlog.

**Categoria C — Criados em batch pelo script de backfill**. Têm `custom_fields.backfill: true` e `source: kiwify`, criados entre 17:23-17:25 (16/06). Foram 16 deals importados de uma planilha externa (script `kiwify-backfill-a010-csv` ou similar), sem passar pelo webhook normal. Por isso `hubla_transactions` está vazia.

Exemplos: `fabricio.erion@live.com`, `romulogali24@outlook.com`, `vilma_rodrigues84@hotmail.com`, `treinamentosassis@icloud.com`, `rogerioads@gmail.com`, `lsdhgamer001@gmail.com`, `uostonmelocorretor@gmail.com`, `edrielsonnalves@gmail.com`, `folhauniversitariarv@gmail.com`, `marceloofficina@hotmail.com`, `fernando.altovale@gmail.com`, `jonasferreira64563@gmail.com`, `lucas_m51@hotmail.com`, `mendesgustavo055@gmail.com`, `victorgiuliano94@gmail.com`, etc.

Ação recomendada: estender `kiwify-backfill-a010-csv` para também criar registros sintéticos em `hubla_transactions` (hubla_id = `kiwify_backfill_<order_id>`) para fechar a contagem do dashboard. Fora de escopo — backlog.

### Categoria de "webhook chegou mas falhou"

Não foram identificados deals nesta categoria nos 28 casos investigados — todos se encaixam em A, B ou C.

---

## Resumo final do dia 16/06

| fonte | deals A010 | em `hubla_transactions` |
|---|---|---|
| Hubla webhook | ~10 | sim |
| Kiwify webhook (normal) | ~30 | sim (após patch + backfill) |
| ClientData legado | 2 | não (backlog) |
| Backfill CSV | ~16 | não (backlog) |
| **Total deals A010 16/06** | **~58** | — |

Órfãos Kiwify restantes na base (june 2026): **0** ✅

## Backlog

- Redirecionar/desativar `clint-webhook-handler` para A010.
- `kiwify-backfill-a010-csv` deve sincronizar `hubla_transactions` para fechar com o dashboard.
- Alerta automático "venda paga sem deal há > 30 min" (já planejado).
- Tornar `linked_method` aceitar `'recovery'` ou padronizar uso de `'manual'`.