
# Corrigir Apurado do Card BU Consorcio: Incluir TODAS as Cartas

## Problema
O card "BU Consorcio" no Painel de Equipe mostra R$ 0,00 para semana e mes, enquanto a pagina principal do Consorcio mostra R$ 8.5MM em "Total em Cartas" para fevereiro.

A causa raiz: o hook `useSetoresDashboard` busca apenas cartas com `categoria = 'inside'` para o setor Efeito Alavanca. Porem, a pagina do Consorcio (`Index.tsx`) soma **todas** as cartas (sem filtro de categoria), o que resulta no valor de R$ 8.5MM.

O card BU Consorcio precisa refletir o total real de todas as cartas, nao apenas as "inside".

## Solucao
Alterar o `ConsorcioMetricsCard` para buscar dados diretamente da mesma fonte que a pagina Index usa (`useConsorcioSummary`), ou criar queries adicionais no `useSetoresDashboard` para incluir todas as cartas.

A abordagem mais limpa e fazer o `ConsorcioMetricsCard` usar o hook `useConsorcioSummary` com filtros de data por periodo (semana, mes, ano) para exibir o valor correto de "Total em Cartas".

## Detalhes Tecnicos

### Alteracao: `src/pages/bu-consorcio/PainelEquipe.tsx` (ConsorcioMetricsCard)

1. Importar `useConsorcioSummary` de `@/hooks/useConsorcio`
2. Chamar o hook 3 vezes com filtros de data para semana, mes e ano (usando as mesmas datas que o `useSetoresDashboard` calcula: `startOfWeek` com `weekStartsOn: 6`, `startOfMonth`, `startOfYear`)
3. Usar `totalCredito` do summary como "Apurado" (valor em carta) para cada periodo
4. Manter as metas vindas de `useSetoresDashboard` (os `metaSemanal`, `metaMensal`, `metaAnual` dos setores efeito_alavanca + credito)
5. Somar o `apuradoSemanal` do setor credito (comissao de `consortium_payments`) como antes

### Resultado
- Card BU Consorcio mostrara R$ 8.5MM+ para o mes (paridade com pagina Index)
- Valores semanais refletirao as cartas contratadas na semana atual
- Metas continuam editaveis pelo modal existente
- Setor Credito continua usando comissao de `consortium_payments`
