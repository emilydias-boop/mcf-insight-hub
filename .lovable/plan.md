

# Adicionar botão de remover ajuste no fechamento Consórcio

## Problema
Atualmente o histórico de ajustes só exibe os itens, sem opção de removê-los. O usuário precisa poder excluir um ajuste adicionado por engano.

## Solução

### Arquivo 1: `src/hooks/useConsorcioFechamento.ts`
Criar hook `useRemoveConsorcioAjuste()`:
- Busca o payout atual e seu `ajustes_json`
- Remove o ajuste pelo índice
- Recalcula `bonus_extra` e `total_conta` subtraindo o valor do ajuste removido
- Atualiza o registro no Supabase
- Invalida queries relevantes

### Arquivo 2: `src/pages/bu-consorcio/FechamentoDetail.tsx`
- Importar o novo hook e o ícone `Trash2`
- No histórico de ajustes, adicionar um botão de lixeira ao lado de cada item (visível apenas quando `canEdit`)
- Ao clicar, chamar `removeAjuste.mutate({ payoutId, index })`

## Resultado esperado
- Cada ajuste no histórico terá um ícone de lixeira clicável
- Ao remover, o `total_conta` e `bonus_extra` são recalculados automaticamente
- Botão só aparece quando o fechamento não está travado

