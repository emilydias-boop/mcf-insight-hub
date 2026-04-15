

## Plano: Navegar pelo Carrinho (Sexta) e mostrar a Safra correspondente

### Contexto
O relatório precisa ser organizado a partir do **carrinho** (sexta-feira), mostrando a safra (Qui-Qua) que alimenta aquele carrinho. O usuário seleciona o carrinho e vê os contratos da safra correspondente.

### Lógica
- O carrinho é na **sexta-feira** (dia do corte)
- A safra que alimenta esse carrinho = **Qui anterior → Qua anterior** (a semana que termina na quarta antes da sexta do carrinho)
- Exemplo: Carrinho sexta 11/04 → Safra Qui 03/04 a Qua 09/04
- Usa `getCartWeekStart(fridayDate - 1 dia)` para encontrar a quinta, e `getCartWeekEnd(...)` para a quarta

### Alterações

**`src/components/crm/R2ContractLifecyclePanel.tsx`**

1. **Remover** `DateRange`, `Calendar`, `Popover`, `startOfMonth`, `endOfMonth`
2. **Adicionar** estado `weekDate` (Date) para navegação por semana
3. **Importar** `getCartWeekStart`, `getCartWeekEnd` de `carrinhoWeekBoundaries` e `addDays`, `subDays`, `addWeeks`, `subWeeks`
4. **Calcular**:
   - `carrinhoFriday` = sexta do carrinho da semana selecionada
   - `safraStart` = quinta (weekStart da semana anterior à sexta) via `getCartWeekStart`
   - `safraEnd` = quarta (weekEnd) via `getCartWeekEnd`
5. **Exibir** header: `"Carrinho Sex 11/04 — Safra: Qui 03/04 → Qua 09/04"` com botões `<` `>` `Hoje`
6. **Passar** `safraStart`/`safraEnd` como `startDate`/`endDate` ao hook

**`src/hooks/useContractLifecycleReport.ts`**

1. Atualizar `getFridayCutoff` para aceitar `weekStart` como parâmetro:
   - `fridayCutoff = weekStart + 1 dia (sexta) às 12:00`
   - Isso garante que "Próxima Semana" funcione corretamente para semanas passadas
2. Adicionar `weekStart?: Date` opcional em `ContractLifecycleFilters`

### Seção técnica

A derivação das datas:
```text
weekDate (qualquer dia) → getCartWeekStart(weekDate) = Quinta
                        → getCartWeekEnd(weekDate) = Quarta
carrinhoFriday = Quinta + 8 dias = Sexta seguinte (dia do carrinho)

Filtro do hook: contract_paid_at entre Quinta 00:00 e Quarta 23:59
Corte "Próxima Semana": carrinhoFriday às 12:00
```

