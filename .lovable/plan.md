
## Melhorar painel de Investigacao: visao "Todos" + dashboard mais rico

### Problemas atuais

1. **Sem opcao "Todos"** -- Nao da pra ver todos os closers/SDRs juntos, so individual
2. **Ranking so aparece pra closers** -- `useCloserComparison` so busca closers, ignora SDRs
3. **Visual simples demais** -- So KPI cards + 1 grafico de barras + 1 ranking. Falta profundidade (grafico de linha de tendencia, tabela comparativa com todos os KPIs, destaque visual)

### Plano

#### 1. Adicionar opcao "Todos os Closers" e "Todos os SDRs" no dropdown

No `InvestigationReportPanel.tsx`, adicionar itens fixos no Select:
- `closer:__all__` = "Todos os Closers"
- `sdr:__all__` = "Todos os SDRs"

Quando `selectedId === '__all__'`, os hooks de periodo devem agregar dados de TODOS (nao filtrar por personId).

#### 2. Criar hook `useTeamInvestigationByPeriod`

Novo hook que quando `personId === '__all__'`:
- **Closers**: busca TODOS os slots no range, todos os attendees, agrupa por dia
- **SDRs**: busca TODOS os attendees no range com booked_by preenchido, agrupa por dia
- Retorna o mesmo `PeriodData` (daily + summary) mas agregado do time inteiro

Alternativa mais simples: modificar `useInvestigationByPeriod` para aceitar `personId === '__all__'` como caso especial que nao filtra por closer/sdr.

#### 3. Expandir `useCloserComparison` para incluir SDRs

Renomear para `useTeamComparison` ou adicionar parametro `type: 'closer' | 'sdr'`:
- Quando type=sdr, busca todos attendees agrupados por `booked_by` (profile_id), resolve nomes via employees
- Retorna o mesmo `ComparisonEntry[]` para o ranking funcionar com SDRs tambem

#### 4. Melhorar os graficos e adicionar novos componentes

**a) Tabela comparativa completa** (novo componente `InvestigationComparisonTable.tsx`)
- Tabela com TODOS closers/SDRs no periodo
- Colunas: Nome, Total, Realizadas, No-Shows, Contratos, Taxa Comparecimento, Taxa Conversao, Taxa No-Show
- Linha do selecionado highlighted
- Ordenavel por coluna
- Mostra quando seleciona "Todos" ou individual (pra comparar)

**b) Grafico de linha de tendencia** (adicionar ao `InvestigationEvolutionChart`)
- Adicionar um `LineChart` ou `ComposedChart` com linha de media movel (3 dias) sobreposta as barras
- Ou separar em 2 graficos: barras diarias + linha de tendencia acumulada

**c) Grafico de pizza/donut** (novo componente `InvestigationDistributionChart.tsx`)
- Distribuicao de status: Realizadas vs No-Shows vs Contratos vs Agendadas
- Mostra visualmente a proporcao

**d) Melhorar ranking**
- Mostrar ranking tanto pra closers quanto SDRs (remover condicao `selectedType === 'closer'`)
- Adicionar barras empilhadas (realizadas + contratos) em vez de so contratos

#### 5. Layout melhorado no painel

Reorganizar:
1. Filtros (dropdown + date range) -- remover o filtro de "dia" separado, unificar tudo no range
2. KPI cards (8 metricas) -- ja existe, manter
3. **Grid 2 colunas**: Evolucao dia a dia (esquerda) + Distribuicao pizza (direita)
4. Tabela comparativa completa do time
5. Ranking horizontal

### Arquivos

| Arquivo | Acao |
|---|---|
| `src/hooks/useInvestigationByPeriod.ts` | Editar -- suportar `personId === '__all__'` |
| `src/hooks/useCloserComparison.ts` | Editar -- suportar type 'sdr' alem de 'closer' |
| `src/components/relatorios/InvestigationReportPanel.tsx` | Refatorar -- opcao "Todos", remover filtro dia separado, novo layout |
| `src/components/relatorios/InvestigationComparisonTable.tsx` | Novo -- tabela comparativa completa |
| `src/components/relatorios/InvestigationDistributionChart.tsx` | Novo -- grafico donut de distribuicao |
| `src/components/relatorios/InvestigationEvolutionChart.tsx` | Melhorar -- adicionar linha de tendencia |
| `src/components/relatorios/InvestigationRankingChart.tsx` | Editar -- barras empilhadas, titulo dinamico |
