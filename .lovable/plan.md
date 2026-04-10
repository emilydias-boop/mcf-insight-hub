

# Fix: KPIs devem acompanhar todos os filtros ativos

## Problema
Os KPIs usam `tipoFilteredData` (filtrado apenas por tipo cliente/empresa), mas ignoram os demais filtros (dia de vencimento, status, busca, etc.). Quando o usuário seleciona "Dia 10", a tabela filtra mas os KPIs continuam mostrando o total geral da aba.

## Correção

### Arquivo: `src/hooks/useConsorcioPagamentos.ts`

Alterar os cálculos de `kpis` e `alertData` para usar `filteredData` (que já tem todos os filtros aplicados) em vez de `tipoFilteredData`.

- `kpis` (linha ~226): trocar dependência de `tipoFilteredData` para `filteredData`
- `alertData` (linha ~270): trocar dependência de `tipoFilteredData` para `filteredData`

Isso garante que KPIs, contadores e alertas reflitam exatamente o que o usuário está vendo na tabela.

