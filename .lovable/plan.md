

## Ajustes no Gráfico "Evolução Dia a Dia" + Exportação dia a dia

### Problemas identificados

1. **Dias faltando no gráfico**: O hook `useInvestigationByPeriod` só retorna dias que TEM dados (reuniões). Dias sem atividade não aparecem. Precisa preencher todos os dias do intervalo.
2. **Sem exportação dia a dia**: O export atual (`exportToExcel`) exporta lista de attendees, não o resumo diário.
3. **Gráfico com elementos desnecessários**: Contratos Pagos (barra), média móvel (linha pontilhada) e cor errada das Agendadas.

### Alterações

| Arquivo | O que muda |
|---|---|
| `src/hooks/useInvestigationByPeriod.ts` | Preencher todos os dias do intervalo (inclusive dias sem dados = zeros) usando `eachDayOfInterval` |
| `src/components/relatorios/InvestigationEvolutionChart.tsx` | Remover barra "Contratos Pagos", remover linha "Média Móvel", trocar cor de Agendadas de `hsl(var(--primary))` para azul (`hsl(210 100% 60%)`), remover ReferenceLine de contratosPagos |
| `src/components/relatorios/InvestigationReportPanel.tsx` | Adicionar botão "Exportar Dia a Dia" que gera Excel com colunas: Data, Agendadas, Realizadas, No-Shows, Contratos Pagos — uma linha por dia do período |

### Detalhes técnicos

**Hook - preencher dias vazios** (linhas 165-180 de `useInvestigationByPeriod.ts`):
- Importar `eachDayOfInterval` de date-fns
- Após agrupar attendees, iterar por todos os dias do range e garantir que cada dia tem entrada (com zeros se não houver dados)

**Gráfico - simplificar** (`InvestigationEvolutionChart.tsx`):
- Remover `movingAvg` function e `mediaMovel` do chartData
- Remover `<Bar dataKey="contratosPagos">` e `<Line dataKey="mediaMovel">`
- Remover `ReferenceLine` de contratosPagos
- Mudar fill de `agendadas` para `hsl(210 100% 60%)` (azul)

**Export dia a dia** (`InvestigationReportPanel.tsx`):
- Nova função `exportDailyToExcel(daily: DailyMetric[], filename: string)` que cria planilha com uma linha por dia
- Botão ao lado do export existente, visível quando há dados de período

