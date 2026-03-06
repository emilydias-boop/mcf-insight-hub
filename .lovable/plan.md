

## Diagnóstico

Existem **7 registros de no-show R2** em março no banco de dados. Após exclusões (reagendados, reembolsados, R2 completados), o número final pode variar.

O problema principal é que o **badge no-show** e a **lista no-show** usam fontes de data **diferentes**:

- **Badge**: usa `rangeStart`/`rangeEnd` do `viewMode` da página principal (Dia/Semana/Mês)
- **Lista do painel**: usa seu próprio estado `dateFilter` interno, que inicia como `'week'` por padrão

Quando você seleciona "Mês" no filtro principal, o badge atualiza para o mês inteiro, mas o painel de No-Shows continua filtrando pela semana atual internamente. Isso explica a divergência.

## Plano de correção

**Arquivo: `src/pages/crm/AgendaR2.tsx`**
- Passar `viewMode`, `selectedDate` e `rangeStart`/`rangeEnd` como props para o `R2NoShowsPanel`

**Arquivo: `src/components/crm/R2NoShowsPanel.tsx`**
- Receber e usar o `viewMode` e `selectedDate` da página pai como estado inicial do filtro de data do painel
- Sincronizar o filtro de data do painel com o filtro principal: quando `viewMode` mudar na página pai, atualizar o `dateFilter` e `selectedDate` do painel via `useEffect`
- Isso garante que badge e lista sempre mostrem o mesmo período

**Resultado**: Badge e lista de no-shows sempre sincronizados com o mesmo período selecionado.

