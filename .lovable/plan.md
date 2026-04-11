

# Fix: CPU Time Exceeded no sync-billing-from-hubla

## Problema
A function ainda estoura o limite de CPU (2s) porque busca 1000 transacoes por chamada, gerando centenas de grupos e fazendo dezenas de queries sequenciais (updates individuais para cada subscription e installment).

## Causa raiz
- `.range(offset, offset + 999)` busca 1000 transacoes
- Cada grupo gera updates individuais via `await` sequencial (linhas 234-236 para subs, 384-418 para installments, 422-433 para due dates)
- Mesmo com `batchSize=50`, os 1000 registros criam muitos grupos

## Correcao

### `supabase/functions/sync-billing-from-hubla/index.ts`

1. **Reduzir range de 1000 para 200** transacoes por chamada (linha 33: `offset + 199`)
2. **Atualizar `hasMore`** (linha 640: `transactions.length >= 200`)
3. **Atualizar `nextOffset`** (linha 651: `offset + 200`)
4. **Reduzir batchSize default** de 50 para 20 (linha 23)

### `src/hooks/useSyncBillingFromHubla.ts`

- Manter `batchSize: 20` no body para acompanhar

Resultado: cada invocacao processa ~200 transacoes (~30-50 grupos), mantendo dentro do limite de 2s de CPU.

