## Causa-raiz confirmada

O `kiwify-webhook-handler` cria a transação em `hubla_transactions` e cria o deal em `crm_deals`, mas **nunca grava `linked_deal_id` de volta** na transação. O `hubla-webhook-handler` faz isso em 4 lugares — o Kiwify não faz em nenhum.

Como o RPC `get_all_hubla_transactions` (fonte do relatório Aquisição e Origem) só conta transações com deal vinculado, **todas as 17 vendas Kiwify ingeridas em 16/06 caem fora do relatório**, gerando o gap 32 → 29.

Os outros 11 casos (9 deals sem ingestão + 2 órfãos) ficam para um plano separado depois.

## Escopo deste plano

Corrigir o `kiwify-webhook-handler` para preencher `linked_deal_id` igual ao `hubla-webhook-handler`, e fazer backfill dos casos do passado que ficaram sem link.

## Passos

### 1. Auditoria precisa do handler (read)
Mapear no `kiwify-webhook-handler/index.ts` os pontos onde:
- Linha ~408: `.insert(dealData)` cria o deal novo (capturar `newDeal.id`)
- Linha ~292: `.update(...)` em deal existente (capturar `existingDeal.id`)
- Linhas ~677/749/778: pontos de insert/update em `hubla_transactions` (capturar `transaction.id`)

Confirmar a ordem dos awaits para garantir que conseguimos o `deal.id` antes do retorno.

### 2. Patch no `kiwify-webhook-handler`
Após cada criação/atualização de deal, adicionar:
```ts
await supabase
  .from('hubla_transactions')
  .update({ linked_deal_id: deal.id })
  .eq('id', transaction.id);
```
Seguir exatamente o padrão do `hubla-webhook-handler` (linhas 1572, 1694, 2399, 2435), incluindo tratamento de erro (log mas não aborta o webhook).

Cobrir os 3 caminhos do Kiwify:
- Novo deal Inside Sales
- Deal existente atualizado (re-compra)
- Outside (sem R1) — checar se existe esse branch no Kiwify

### 3. Backfill retroativo (one-shot)
Edge function nova `kiwify-backfill-linked-deal-id` (ou reaproveitar `kiwify-backfill-a010-csv`), com `dry_run` default true:

```sql
UPDATE hubla_transactions ht
SET linked_deal_id = d.id
FROM crm_contacts c
JOIN crm_deals d ON d.contact_id = c.id
WHERE ht.source = 'kiwify'
  AND ht.linked_deal_id IS NULL
  AND lower(ht.customer_email) = lower(c.email)
  AND d.created_at BETWEEN ht.created_at - interval '7 days'
                       AND ht.created_at + interval '7 days'
  AND ht.created_at >= '2026-01-01'
```

Critério de match: email + janela de ±7 dias entre transação e deal. Se houver múltiplos deals no range, escolher o mais próximo no tempo. Retornar JSON com `updated_count`, `multiple_match_count`, `no_match_count`.

Rodar primeiro em `dry_run=true`, mostrar prévia, depois rodar de verdade após sua aprovação.

### 4. Verificação
Após o backfill rodar real:
- Re-query: `SELECT COUNT(*) FROM hubla_transactions WHERE source='kiwify' AND linked_deal_id IS NULL AND created_at >= '2026-06-16' AND created_at < '2026-06-17'` → esperado 0 ou bem perto
- Re-query do RPC `get_all_hubla_transactions` para 16/06 → esperado subir de 29 para ~32
- Comparar a contagem nova com a aba CRM (Pipeline Inside Sales filtro A010 16/06)

### 5. Documentação QA
`docs/qa/2026-06-17-fix-kiwify-linked-deal-id.md` com:
- Diagnóstico (handler Hubla faz, Kiwify não fazia)
- Patch aplicado (links de linha)
- Resultado do backfill (números antes/depois)
- Os 11 casos restantes (9 deals sem ingestão + 2 órfãos puros) listados como follow-up

## Fora de escopo (planos separados depois)
- Recuperar `mjosedanielmoreira@gmail.com` e `leilaiarat@gmail.com` (2 órfãos)
- Investigar os 9 deals criados sem ingestão de webhook Kiwify (provável falha silenciosa do webhook ou criação manual)
- Alerta automático "venda paga sem deal" / "transação sem linked_deal_id"

## Risco / rollback
- Patch só adiciona um `UPDATE`; se falhar, log mas não quebra o webhook (mesma postura do Hubla handler)
- Backfill em `dry_run` primeiro; em produção é só `UPDATE` no campo `linked_deal_id` (idempotente, reversível por SQL com `SET linked_deal_id = NULL` filtrado pela mesma condição)
