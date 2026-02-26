
Objetivo: corrigir o **Bruto Total** da página **/bu-incorporador/transacoes** para bater com o valor real (e com o dashboard quando filtros equivalentes).

Implementação:
1) Ajustar cálculo do card de resumo em `src/pages/bu-incorporador/TransacoesIncorp.tsx`  
- Trocar `totals.bruto` baseado em `transactionGroups` para soma direta de `filteredByCloser` usando `getDeduplicatedGross(tx, globalFirstIds.has(tx.id))`.  
- Manter `totals.liquido` por grupos (como já está), pois o agrupamento evita dupla contagem de net no carrinho.

2) Corrigir regra de bruto em grupos com order bump em `src/components/incorporador/TransactionGroupRow.tsx`  
- Em `groupTransactionsByPurchase`, na segunda passagem (`group.orderBumps.length > 0`), parar de “zerar” vendas válidas do item principal.  
- Estratégia: calcular `grossAllTransactions` (todas as transações do grupo) e `grossOffersOnly`; usar `grossOffersOnly` somente quando ele for > 0, senão usar `grossAllTransactions`.

3) Manter consistência visual e exportação  
- Garantir que o valor do card “Bruto Total” e o total exportado continuem usando a mesma regra de deduplicação global.

Validação:
1) Abrir `/bu-incorporador/transacoes` com período 01/02/2026–26/02/2026 e conferir se o **Bruto Total** sobe exatamente no delta faltante (caso observado: +R$ 16.500).  
2) Conferir o caso do grupo com `hubla_id` base `bb1c3539-2504-4e46-845d-ae9c13ad648a` (A001) para validar que o bruto não fica zerado indevidamente.  
3) Comparar com o card mensal de **MCF Incorporador** no dashboard usando mesmo recorte de data/filtros.

Detalhes técnicos:
- Causa raiz: `groupTransactionsByPurchase` sobrescreve `totalGross` para “somente offers” em qualquer grupo com `-offer-*`, o que descarta bruto válido do item principal em grupos mistos.  
- Impacto esperado: correção do bruto na página de vendas sem alterar RPCs, sem migração de banco e sem mexer em regras de deduplicação global.
