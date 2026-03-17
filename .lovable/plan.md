

## Adicionar metas diarias/semanais ao painel de Investigacao

### Contexto

As metas da equipe ja existem na tabela `team_targets` com tipos como `sdr_agendamento_dia`, `sdr_r1_realizada_dia`, `sdr_contrato_dia`, etc. O hook `useSdrTeamTargets` ja busca esses dados. O que falta e integrar essas metas ao painel de Investigacao para mostrar se cada pessoa (ou o time) esta batendo a meta diaria/semanal.

### Implementacao

#### 1. Buscar metas no painel (`InvestigationReportPanel.tsx`)

- Importar e usar `useSdrTeamTargets` para buscar metas diarias da equipe
- Extrair targets relevantes: `sdr_agendamento_dia` (ou `closer` equivalente), `sdr_r1_realizada_dia`, `sdr_contrato_dia`
- Passar como props para os componentes de grafico e tabela

#### 2. Linha de meta no grafico de evolucao (`InvestigationEvolutionChart.tsx`)

- Receber props opcionais `dailyTargets?: { agendadas?: number; realizadas?: number; contratosPagos?: number }`
- Adicionar `ReferenceLine` horizontal do recharts para cada meta configurada (ex: linha tracejada vermelha em y=5 para "meta agendamentos/dia")
- Isso permite ver visualmente em cada dia se bateu ou nao a meta

#### 3. Coluna de atingimento na tabela comparativa (`InvestigationComparisonTable.tsx`)

- Receber `dailyTargets` como prop
- Calcular dias uteis no periodo selecionado
- Adicionar coluna "% Meta" que compara: `(contratosPagos / (metaDiaria * diasUteis)) * 100`
- Colorir: verde >= 100%, amarelo >= 70%, vermelho < 70%
- Permitir ordenar por essa coluna

#### 4. Mini cards de atingimento de meta nos KPIs

- Abaixo dos KPI cards atuais, adicionar uma linha de cards mostrando "Meta Dia vs Real":
  - "Realizadas Hoje: X / meta Y" com barra de progresso (reutilizar `MetricProgressCell`)
  - Quando periodo = semana, mostrar acumulado vs meta semanal
  - Quando periodo = mes, mostrar acumulado vs meta mensal
- Usar a logica: se range <= 1 dia, comparar com meta dia; se <= 7 dias, com meta semana; senao meta mes

### Arquivos

| Arquivo | Acao |
|---|---|
| `src/components/relatorios/InvestigationReportPanel.tsx` | Importar `useSdrTeamTargets`, calcular metas por periodo, passar props, adicionar cards de atingimento |
| `src/components/relatorios/InvestigationEvolutionChart.tsx` | Adicionar `ReferenceLine` para metas diarias |
| `src/components/relatorios/InvestigationComparisonTable.tsx` | Adicionar coluna "% Meta" com atingimento colorido |

