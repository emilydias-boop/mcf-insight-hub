

# Fix: Botão "Revisar Boletos" não aparece — erro na query

## Causa raiz
A query do hook `useBoletosReview` faz join com `consortium_cards` pedindo a coluna `cliente_nome`, que **não existe**. O nome correto é `nome_completo`. Isso causa erro 400 do Supabase, retornando array vazio, e o botão nunca aparece (condição `reviewBoletos.length > 0` é sempre falsa).

## Mudança

### `src/hooks/useConsorcioBoletos.ts`
Na função `useBoletosReview` (aprox. linha 121):
- Trocar `cliente_nome` por `nome_completo` no select do join: `consortium_cards!consorcio_boletos_card_id_fkey(nome_completo, grupo, cota)`
- Trocar o mapeamento `b.consortium_cards?.cliente_nome` por `b.consortium_cards?.nome_completo`

Uma linha de código corrigida e o botão vai aparecer com os 40 boletos pendentes.

