
# Plano: Excluir Transações Temporárias (newsale-) da Listagem

## Problema Identificado

O cliente Robson Moreira aparece com **2 transações de contrato** porque:

1. `newsale-1769525395779` → Transação temporária (webhook inicial) - net_value: R$ 0,00
2. `0968afcd-5ac9-...` → Transação real (confirmação) - net_value: R$ 460,76

As transações com prefixo `newsale-` são registros temporários criados pelo webhook da Hubla **antes** da confirmação do pagamento. Quando o pagamento é confirmado, a Hubla envia outro webhook com o `hubla_id` definitivo (UUID).

A função `get_first_transaction_ids` já ignora essas transações (`hubla_id NOT LIKE 'newsale-%'`), mas a função `get_all_hubla_transactions` **não está filtrando**, causando a duplicidade na listagem.

## Solução

Adicionar o filtro `AND ht.hubla_id NOT LIKE 'newsale-%'` na função RPC `get_all_hubla_transactions`.

## Alteração Técnica

### Migration SQL

```sql
-- Na função get_all_hubla_transactions, adicionar filtro:
WHERE pc.target_bu = 'incorporador'
  AND ht.sale_status IN ('completed', 'refunded')
  AND ht.source IN ('hubla', 'manual')
  AND ht.hubla_id NOT LIKE 'newsale-%'  -- NOVO: Excluir temporárias
  AND (p_search IS NULL OR ...)
```

## Impacto Esperado

| Antes | Depois |
|-------|--------|
| Robson com 2 linhas | Robson com 1 linha |
| Segunda linha "Recorrente" R$ 0,00 | Removida |
| Total de transações maior | Total correto (sem duplicatas) |

## Arquivo a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/[timestamp]_exclude_newsale_transactions.sql` | Adiciona filtro para excluir transações temporárias |

## Observação

A mesma correção será aplicada na função `get_hubla_transactions_by_bu` para garantir consistência em todas as BUs.
