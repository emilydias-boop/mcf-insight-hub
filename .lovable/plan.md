

## Remover "Ajustar Semana do Carrinho" (Week Override)

Concordo — com a configuração de carrinhos já definindo dias da semana e horários de corte, o override manual de datas é redundante. A navegação por setas (semana anterior/próxima) já permite mudar a semana visualizada.

### Mudanças em `src/pages/crm/R2Carrinho.tsx`

1. **Remover imports**: `useCarrinhoWeekOverride`, `CarrinhoWeekOverrideDialog`, `CalendarCog`
2. **Remover state**: `overrideDialogOpen`, `ignoreOverride`
3. **Remover lógica de override**: variável `activeOverride`, condicionais no `weekStart`/`weekEnd` (usar sempre `getCustomWeekStart`/`getCustomWeekEnd`)
4. **Simplificar navegação**: `handlePrevWeek`/`handleNextWeek`/`handleToday` ficam simples (sem checar override)
5. **Remover botão** `CalendarCog` do header e o badge "Semana customizada"
6. **Remover renderização** do `<CarrinhoWeekOverrideDialog />`

O hook `useCarrinhoWeekOverride.ts` e o componente `CarrinhoWeekOverrideDialog.tsx` continuam existindo no código (podem ser úteis futuramente), apenas deixam de ser usados nesta página.

