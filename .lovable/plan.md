

## Evolucionar o painel de Investigacao com graficos de performance e SDRs

### Problemas identificados

1. **Dropdown so mostra Closers** -- O filtro usa `useGestorClosers()` que consulta apenas a tabela `closers`. SDRs nao aparecem.
2. **Sem graficos de performance** -- Atualmente so exibe uma tabela de atendimentos de um unico dia. Nao ha evolucao dia a dia, taxas de conversao, nem comparacao com outros closers/SDRs.
3. **Filtro e apenas por dia** -- Nao permite selecionar um periodo (date range) para ver evolucao.

### Plano de implementacao

#### 1. Adicionar SDRs ao dropdown (InvestigationReportPanel.tsx)

- Criar um hook `useGestorSDRs` (ou reutilizar dados de `employees` com `cargo LIKE '%SDR%'` ou da `SDR_LIST` + `profiles`) que retorne `{ id, name, email, type: 'sdr' }`.
- Alterar o dropdown para combinar closers e SDRs em grupos separados (com `<SelectGroup>` label "Closers" e "SDRs").
- Armazenar tambem o `type` selecionado ('closer' | 'sdr') para direcionar a query correta.

#### 2. Trocar filtro de data unica para date range

- Substituir o `DatePickerCustom mode="single"` por `mode="range"` com `startDate`/`endDate`.
- Manter o default como mes atual.

#### 3. Criar hook `useInvestigationByPeriod` (novo hook)

- Recebe `closerId | sdrEmail`, `startDate`, `endDate`, `type: 'closer' | 'sdr'`.
- Para closers: query `meeting_slots` por `closer_id` no range, join `meeting_slot_attendees`.
- Para SDRs: query `meeting_slot_attendees` por `booked_by` (profile_id do SDR) no range, join `meeting_slots`.
- Retorna dados agrupados por dia: `{ date, agendadas, realizadas, noShows, contratosPagos }`.
- Tambem retorna metricas consolidadas do periodo (totais + taxas).

#### 4. Criar hook `useCloserComparison` (novo hook)

- Para o periodo selecionado, busca metricas de TODOS os closers/SDRs ativos.
- Retorna array rankeado por contratos pagos (ou conversao), para comparar o selecionado com os demais.

#### 5. Adicionar graficos ao painel (InvestigationReportPanel.tsx)

Apos os MetricCards, adicionar:

**a) Grafico de Evolucao Dia a Dia** (BarChart com recharts)
- Eixo X: dias do periodo
- Barras: Agendadas, Realizadas, No-Shows, Contratos Pagos
- Mostra a tendencia visual da performance ao longo do tempo

**b) KPIs de Periodo** (cards adicionais)
- Taxa de Comparecimento (Realizadas / Agendadas)
- Taxa de Conversao (Contratos / Realizadas)
- Taxa de No-Show

**c) Grafico de Comparacao / Ranking** (BarChart horizontal)
- Todos os closers/SDRs no periodo
- Barras horizontais mostrando contratos, com o selecionado destacado
- Permite ver posicao relativa

#### 6. Manter tabela de atendimentos

- A tabela existente continua abaixo dos graficos, agora mostrando todos os atendimentos do periodo (nao mais apenas 1 dia).
- Adicionar paginacao ou limite se o periodo for longo.

### Arquivos a criar/editar

| Arquivo | Acao |
|---|---|
| `src/hooks/useInvestigationByPeriod.ts` | Novo -- query por periodo com agrupamento diario |
| `src/hooks/useCloserComparison.ts` | Novo -- ranking de todos closers/SDRs no periodo |
| `src/hooks/useGestorSDRs.ts` | Novo -- lista SDRs ativos para o dropdown |
| `src/components/relatorios/InvestigationReportPanel.tsx` | Refatorar -- adicionar SDRs, date range, graficos, ranking |
| `src/components/relatorios/InvestigationEvolutionChart.tsx` | Novo -- grafico de evolucao dia a dia |
| `src/components/relatorios/InvestigationRankingChart.tsx` | Novo -- grafico comparativo horizontal |

