## Problema

Na aba **Previsão de Comissões** (semana #21, pagamento 28/05/2026), o card mostra **R$ 307.332** mas o valor efetivamente recebido foi ~R$ 287k. A diferença vem de parcelas que pertencem a **cotas canceladas** (`consortium_cards.status = 'cancelado'`) — hoje o hook só filtra `consortium_installments.status = 'pago'`, mas não olha o status da cota.

Confirmei na base:
- Existem 30 cotas com `status='cancelado'`.
- Na janela 14–20/mai há parcelas "pagas" vinculadas a cotas canceladas sendo somadas no total.

Parcelas não pagas já estão fora do cálculo (filtro `eq('status','pago')`), então o ajuste necessário é só excluir cotas canceladas.

## Mudança

Arquivo: `src/hooks/useConsorcioPrevisaoComissoes.ts`

1. No `select` do join `consortium_cards!inner(...)`, incluir `status`.
2. Adicionar filtro na query: `.in('consortium_cards.status', ['ativo', 'contemplado'])` — ou seja, excluir `cancelado` (e qualquer status futuro que não represente cota válida em pagamento).
3. Como defesa extra, no loop de agregação, pular `if (card.status === 'cancelado') continue;`.

## Resultado esperado

Os totais de parcelas, cotas distintas, valor de parcela e **comissão** de cada semana passam a refletir apenas cotas ativas/contempladas. O card da semana #21 cai dos R$ 307.332 atuais para o valor real recebido (~R$ 287k), e o comportamento vale para todas as semanas e para o destaque de "Próxima semana".

Sem mudanças em UI/business logic além do filtro.
