

## Problema: Faturamento no Fechamento usa todas as BUs em vez de só Incorporador

### Causa raiz
O hook `useTeamRevenueByMonth` (linha 28-56 de `src/hooks/useTeamRevenueByMonth.ts`) para `bu === 'incorporador'` chama `get_all_hubla_transactions` — que retorna transações de **todas as BUs** (Incorporador + Consórcio + Leilão + Crédito etc.), totalizando R$ 1.810.940,92.

A página de Vendas (`TransacoesIncorp.tsx`) usa `get_hubla_transactions_by_bu('incorporador')`, que filtra apenas transações da BU Incorporador, totalizando R$ 1.444.641,00.

### Correção
Em `src/hooks/useTeamRevenueByMonth.ts`, trocar a chamada de `get_all_hubla_transactions` para `get_hubla_transactions_by_bu` passando `p_bu = 'incorporador'`, mantendo a mesma lógica de deduplicação com `get_first_transaction_ids` e `getDeduplicatedGross`.

### Detalhe técnico
- RPC atual: `supabase.rpc('get_all_hubla_transactions', { p_start_date, p_end_date, p_limit: 10000, p_search: null, p_products: null })`
- RPC correta: `supabase.rpc('get_hubla_transactions_by_bu', { p_bu: 'incorporador', p_search: null, p_start_date, p_end_date, p_limit: 10000 })`

Alteração em 1 arquivo: `src/hooks/useTeamRevenueByMonth.ts`

