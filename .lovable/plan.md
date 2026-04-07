
# Checkboxes sob demanda + Filtro de Boleto

## Problema
1. Os checkboxes ficam sempre visíveis na tabela, poluindo a interface quando o usuário não quer fazer envio em massa
2. Não existe filtro para ver quais parcelas têm boleto vinculado e quais não têm

## Mudanças

### 1. `ConsorcioPagamentosTab.tsx` — Botão "Envio em Massa"
- Adicionar estado `bulkMode` (boolean, default false)
- Adicionar botão "Envio em Massa" ao lado do "Exportar"
- Quando ativado, mostra os checkboxes na tabela e a barra de ações
- Quando desativado, esconde checkboxes e limpa seleção
- Passar `bulkMode` como prop para `PagamentosTable`

### 2. `PagamentosTable.tsx` — Checkboxes condicionais
- Receber nova prop `bulkMode: boolean`
- Só renderizar coluna de checkbox (header + cells) quando `bulkMode === true`
- Quando `bulkMode === false`, não renderizar a coluna, tabela fica limpa

### 3. `PagamentosFilters.tsx` + `useConsorcioPagamentos.ts` — Filtro "Boleto"
- Adicionar campo `filtroBoleto` ao `PagamentosFiltersState`: `'todos' | 'com_boleto' | 'sem_boleto'`
- Adicionar dropdown "Boleto" nos filtros com opções: "Todos", "Com Boleto", "Sem Boleto"
- A filtragem será feita no `ConsorcioPagamentosTab` ou `PagamentosTable` pois a info de boleto vem de query separada (`useBoletosByInstallments`)
- Na prática: passar o filtro para `PagamentosTable`, que já tem o `boletoMap`, e filtrar `data` internamente antes de renderizar

### Arquivos
- `src/hooks/useConsorcioPagamentos.ts` — adicionar `filtroBoleto` ao tipo de filtros e default
- `src/components/consorcio/pagamentos/PagamentosFilters.tsx` — dropdown "Boleto"
- `src/components/consorcio/pagamentos/PagamentosTable.tsx` — checkboxes condicionais + filtro por boleto
- `src/components/consorcio/pagamentos/ConsorcioPagamentosTab.tsx` — botão "Envio em Massa" toggle
