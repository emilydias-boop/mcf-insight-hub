
Objetivo: corrigir o número “Aprovado 56” que você ainda vê na aba Agenda R2 > Relatório. Pela leitura do código, isso está vindo do front dessa tela, não do painel principal de métricas.

Diagnóstico
- A tela do print não usa `R2MetricsPanel`.
- Ela usa `R2ContractLifecyclePanel` + `useContractLifecycleReport`.
- Nesse fluxo, o hook chama a RPC com `p_apply_contract_cutoff: false` e depois o front monta os cards filhos de “Realizadas” agrupando só por `r2StatusName`.
- Resultado: todo lead com R2 realizada + status “Aprovado” entra no card “Aprovado”, mesmo quando `dentro_corte = false`.
- Por isso o banco já pode estar melhor, mas essa aba continua mostrando 56.

O que vou ajustar
1. `src/hooks/useContractLifecycleReport.ts`
- Passar a carregar e preservar no row:
  - `dentro_corte`
  - `effective_contract_date`
  - `contract_source`
- Parar de reconstruir a data de contrato de forma paralela quando a RPC já trouxe a data efetiva correta.
- Manter a lógica do relatório completa, mas com metadata suficiente para separar aprovado da safra vs aprovado tardio.

2. `src/components/crm/R2ContractLifecyclePanel.tsx`
- Corrigir os cards filhos de “Realizadas”.
- Em vez de agrupar apenas por `r2StatusName`, separar:
  - `Aprovado` = realizado + status aprovado + `dentro_corte = true`
  - `Aprovado tardio` (ou “Fora do corte”) = realizado + status aprovado + `dentro_corte = false`
  - `Próxima Semana`, `Reprovado`, `Sem status` seguem como hoje
- Assim o card “Aprovado” dessa aba passa a refletir a safra correta.

3. Filtro da tabela
- Quando clicar no card “Aprovado”, a tabela deve mostrar só os 45 da safra.
- Quando clicar em “Aprovado tardio/Fora do corte”, a tabela mostra os excedentes que hoje estão inflando o 56.

Validação esperada
- Na aba Relatório, o card filho “Aprovado” cai de 56 para 45.
- A diferença aparece em um bucket separado de tardios/fora do corte, em vez de sumir.
- O nome e a lista filtrada ficam consistentes com a regra que você já definiu.
- O restante do relatório continua funcionando sem mexer na lógica de “Total Pagos”, “Pendentes”, “No-show” etc.

Detalhe técnico
- O problema central não parece ser mais a RPC em si nessa tela, e sim que o front do relatório ainda trata “Aprovado” como “qualquer R2 aprovada realizada”, ignorando `dentro_corte`.
- Então o ajuste principal agora é frontend nessa aba específica.
