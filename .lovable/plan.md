
Objetivo

- Fazer o “Total Conta” e o “Valor Variável” usarem uma única fonte de verdade na UI: o valor já salvo em `sdr_month_payout`.

Diagnóstico

- Hoje o detalhe individual (`src/pages/fechamento-sdr/Detail.tsx`) mostra o topo com cálculo ao vivo:
  - `calculatedVariavel.total`
  - `effectiveFixoDisplay + calculatedVariavel.total`
- Já a tabela, o CSV e boa parte do restante da tela trabalham com os campos persistidos:
  - `payout.valor_variavel_total`
  - `payout.total_conta`
- Para Closers isso piora porque o detalhe mistura `useCalculatedVariavel` com `useCloserAgendaMetrics`, enquanto a listagem usa o payout salvo. Resultado: números diferentes para a mesma pessoa.

Implementação

1. `src/pages/fechamento-sdr/Detail.tsx`
   - Trocar os cards financeiros do topo para sempre exibir os valores salvos:
     - Fixo: `payout.valor_fixo`
     - Variável: `payout.valor_variavel_total`
     - Total Conta: `payout.total_conta`
   - Manter o cálculo ao vivo apenas para comparação/alerta:
     - badge “Recalcular” continua aparecendo quando o salvo divergir do cálculo atual
   - Manter os indicadores dinâmicos e KPIs como estão, porque eles servem como preview operacional, não como fonte oficial do valor financeiro.

2. `src/components/fechamento/PayoutTableRow.tsx`
   - Simplificar a row para parar de recalcular valor variável/total localmente.
   - Exibir direto:
     - `payout.valor_variavel_total`
     - `payout.total_conta`
   - Remover dependências hoje usadas só para esse recálculo:
     - `useActiveMetricsForSdr`
     - `useSdrMonthKpi`
     - `useCalculatedVariavel`
     - `useEffect`, `useRef`, `Skeleton`
   - Remover também o callback `onCalculated`, que deixa a listagem misturando salvo + cálculo local.

3. `src/pages/fechamento-sdr/Index.tsx`
   - Remover `calculatedValues`, `calculatedValuesRef` e `handleRowCalculated`
   - Fazer os cards-resumo do topo somarem apenas os campos já persistidos do payout
   - Atualizar o uso de `<PayoutTableRow />` sem `onCalculated`

Resultado esperado

```text
Hoje:
- Tabela / exportação -> valor salvo
- Individual -> cálculo ao vivo

Depois:
- Tabela -> valor salvo
- Cards de resumo -> valor salvo
- Individual -> valor salvo
- Indicadores -> cálculo ao vivo
- Badge "Recalcular" -> aviso de diferença entre salvo x cálculo atual
```

Com isso, a Cris passará a mostrar no individual exatamente o mesmo `Total Conta` salvo que aparece na tabela. Se o cálculo atual estiver diferente, a tela ainda vai sinalizar isso para você decidir se quer recalcular.

Detalhes técnicos

- Não precisa mudar banco nem edge function para este ajuste.
- A fonte oficial passa a ser `sdr_month_payout`.
- O cálculo ao vivo continua útil para auditoria visual, mas não vai mais sobrescrever o valor financeiro exibido ao usuário.
