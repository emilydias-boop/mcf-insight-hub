

## Causa raiz do conflito de valores

O problema é claro:

| Local | RPC usada | Filtro de BU |
|---|---|---|
| **Dashboard** (Painel do Diretor) | `get_hubla_transactions_by_bu('incorporador')` | Sim — só produtos com `target_bu = 'incorporador'` |
| **Vendas MCF Incorporador** | `get_all_hubla_transactions` | **Não** — retorna TODAS as transações de TODAS as BUs |

A página "Vendas MCF INCORPORADOR" mostra R$ 1.766.911,92 porque inclui transações de Consórcio, Leilão, Projetos, etc. O Dashboard mostra R$ 1.417.112,00 porque filtra corretamente só produtos do Incorporador.

A diferença de ~R$ 350.000 são transações de outras BUs que aparecem na página de Vendas mas não pertencem ao Incorporador.

## Correção

**Arquivo: `src/pages/bu-incorporador/TransacoesIncorp.tsx`**

1. Trocar `useAllHublaTransactions(filters)` por `useTransactionsByBU('incorporador', filters)` — mesma RPC que o Dashboard usa.
2. Adaptar o formato de data para consistência com o hook (timezone BRT).
3. Manter toda a lógica de deduplicação, agrupamento e filtro por closer igual.

**Arquivo: `src/hooks/useTransactionsByBU.ts`**

4. Adicionar suporte ao parâmetro `selectedProducts` (filtro de produtos) que a página de Vendas usa — verificar se a RPC aceita, senão filtrar client-side.
5. Ajustar formato de data para timezone BRT (atualmente usa `.toISOString()` que é UTC).

Resultado: Dashboard e Vendas MCF Incorporador vão usar a mesma RPC com o mesmo filtro de BU, garantindo paridade total nos valores.

