

## Problema: R2 Agendadas não funciona como indicador de variável

### Diagnóstico

O `METRIC_CONFIG` para `r2_agendadas` (linha 310-316 de `useActiveMetricsForSdr.ts`) **não tem** `isDynamicCalc: true` nem `payoutPctField/payoutMultField/payoutValueField`. Isso causa:

1. **Indicador visual**: Cai no fallback "simple card" (linha 212-240 de `DynamicIndicatorCard.tsx`) — mostra apenas o valor bruto + peso, sem barra de progresso, sem meta, sem multiplicador, sem valor R$
2. **Cálculo do variável**: No `useCalculatedVariavel.ts` (linha 128-131), R2 Agendadas é **pulada** (`continue`) — não contribui para o variável total
3. **KPI form**: O formulário de Closer não mostra R2 Agendadas — o campo não existe no form, então o coordenador não vê o valor automático

### Correções

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `useActiveMetricsForSdr.ts` | Adicionar `isDynamicCalc: true` ao config de `r2_agendadas` — isso faz o card renderizar como `SdrIndicatorCard` com meta/realizado/multiplicador/valor, e faz o `useCalculatedVariavel` incluí-lo no cálculo do variável |
| 2 | `DynamicIndicatorCard.tsx` | Nenhuma mudança necessária — o código `isDynamicCalc` já lida com `meta_percentual`, `meta_valor`, e peso. Basta o config estar correto |
| 3 | `useCalculatedVariavel.ts` | Nenhuma mudança necessária — já processa `isDynamicCalc` automaticamente |
| 4 | `KpiEditForm.tsx` | Adicionar campo read-only de "R2 Agendadas" na seção Closer, mostrando o valor automático da agenda (`agendaMetrics.data.r2_agendadas`) para visibilidade |

### Como vai funcionar após a correção

- **Config de Métricas**: Admin configura R2 Agendadas com peso (ex: 50%) e meta (ex: "Opcional" ou valor fixo)
- **Card indicador**: Renderiza com barra de progresso, % de entrega, multiplicador, e valor R$ calculado = (variável × peso%) × multiplicador
- **Variável**: R2 Agendadas contribui para o total do variável conforme o peso configurado
- **Form KPI**: Mostra o valor automático da agenda no formulário do Closer

