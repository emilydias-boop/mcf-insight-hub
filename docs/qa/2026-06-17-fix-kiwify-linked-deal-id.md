# Fix: Kiwify webhook não preenchia `linked_deal_id` em `hubla_transactions`

**Data:** 17/06/2026
**Origem:** Investigação da discrepância A010 do dia 16/06 (CRM=32 / Relatório=29)

## Causa-raiz

O `hubla-webhook-handler` grava `hubla_transactions.linked_deal_id` em 4 pontos
(linhas 1572, 1694, 2399, 2435). O `kiwify-webhook-handler` **nunca fazia esse
vínculo** — criava a transação e o deal, mas nunca atualizava o ponteiro.

Como o RPC `get_all_hubla_transactions` (fonte do relatório
`/bu-incorporador/relatorios` → Aquisição e Origem) faz `INNER JOIN` por
`linked_deal_id`, **todas as vendas Kiwify ingeridas ficavam de fora do
relatório**, mesmo tendo deal no CRM.

Era esse o motivo do gap 32 → 29 que você observou no dia 16/06.

## Patch

`supabase/functions/kiwify-webhook-handler/index.ts`

1. `createOrUpdateKiwifyCRMContact` agora retorna `{ dealId: string | null }`
   em todos os caminhos (parceiro bloqueado, deal existente atualizado, deal
   novo criado, falta de dados).
2. Após a chamada do CRM no handler do evento `order_paid`, gravamos:
   ```ts
   await supabase
     .from('hubla_transactions')
     .update({ linked_deal_id: crmResult.dealId })
     .eq('id', transactionId);
   ```
   Falha de update é logada mas não derruba o webhook (mesma postura do Hubla).

## Backfill retroativo

Nova edge function: `kiwify-backfill-linked-deal-id`.

Match: `lower(customer_email)` + deal mais próximo no tempo dentro de `±7 dias`.
Body `{ dry_run, since, until, window_days, limit }`.

### Execução do dia 17/06 (since=2026-01-01)

| Métrica | Valor |
|---|---|
| Candidatos varridos | 53 |
| Vinculados | 11 (datas antigas) + 39 (junho, executados em chamada anterior) = **50** |
| Sem contact (órfão) | 15 |
| Sem deal na janela de 7 dias | 27 |
| Erros | 0 |

Restam 42 órfãos reais (sem deal correspondente no CRM) — escopo do próximo
plano de recuperação.

## Verificação

```sql
SELECT date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
       COUNT(*) FILTER (WHERE linked_deal_id IS NULL) AS sem_link,
       COUNT(*) FILTER (WHERE linked_deal_id IS NOT NULL) AS com_link
FROM hubla_transactions
WHERE source = 'kiwify' AND created_at >= '2026-06-01'
GROUP BY 1 ORDER BY 1 DESC;
```

Resultado pós-fix (dia 16/06): 26 com link / 1 sem link
(`mjosedanielmoreira@gmail.com` — órfão sem contact).

## Re-rodar o backfill (idempotente)

```bash
curl -X POST https://<project>.supabase.co/functions/v1/kiwify-backfill-linked-deal-id \
  -H 'Authorization: Bearer <anon>' \
  -H 'Content-Type: application/json' \
  -d '{"dry_run": true, "since": "2026-01-01T00:00:00Z"}'
```

Trocar `dry_run` para `false` após revisar a prévia.

## Rollback

```sql
-- Desfaz vínculos criados por este backfill (filtrar pela janela executada)
UPDATE hubla_transactions
SET linked_deal_id = NULL
WHERE source = 'kiwify'
  AND created_at >= '2026-01-01'
  AND linked_deal_id IS NOT NULL;
```

Re-rodar o backfill recria os vínculos.

## Follow-up (planos separados)

1. **Recuperar 2 órfãos do dia 16/06** — `mjosedanielmoreira@gmail.com` (sem
   contact) e `weltonoliveira421@gmail.com` (sem deal). Aproveitar a edge
   function `backfill-orphan-a010-deals` já existente.
2. **Investigar 9 deals Kiwify de 16/06 criados sem ingestão de webhook**
   (provável falha silenciosa do endpoint Kiwify ou criação manual paralela).
3. **Alerta automático** "venda paga sem deal" / "transação sem
   linked_deal_id após 5 min".