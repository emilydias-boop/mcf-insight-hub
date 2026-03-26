

## Redesign completo: Dashboard de Performance Individual do SDR

### Escopo

Reescrever a página `SdrMeetingsDetailPage.tsx` e seus componentes filhos como um dashboard gerencial premium, com foco em **meta, atingimento, gap, comparação de período e projeção**.

### Dados disponíveis no sistema

- `useSdrDetailData`: métricas do SDR (agendamentos, r1Agendada, r1Realizada, noShows, contratos), média do time, ranking, meetings, metaDiaria
- `useSdrCallMetrics`: totalCalls, answered, unanswered, avgDurationSeconds
- `contarDiasUteis()`, `isDiaUtil()` de `src/lib/businessDays.ts`: cálculo de dias úteis com feriados
- `useTeamMeetingsData`: dados do time para comparação
- Meta diária vem da tabela `sdr.meta_diaria`

### Dados que precisam ser adicionados

- **Período comparativo**: uma segunda chamada ao `useTeamMeetingsData` com datas do período anterior (calculadas client-side)
- **Meta do período**: calculada client-side a partir de `meta_diaria × dias úteis no período`

---

### Arquitetura de arquivos

| Arquivo | Ação |
|---------|------|
| `SdrMeetingsDetailPage.tsx` | Reescrever — nova estrutura com filtros, seções e componentes novos |
| `SdrDetailHeader.tsx` | Manter com ajustes mínimos |
| `SdrDetailKPICards.tsx` | **Reescrever** — cards com meta, atingimento, gap e variação comparativa |
| `SdrProjectionCard.tsx` | **Criar** — card de projeção com meta final, realizado, projeção, gap, necessário/dia |
| `SdrAutoSummary.tsx` | **Criar** — resumo textual dinâmico gerado a partir das métricas |
| `SdrMetaVsRealizadoChart.tsx` | **Criar** — barras horizontais meta × realizado × projeção |
| `SdrCumulativeChart.tsx` | **Criar** — gráfico de linha acumulado vs meta acumulada vs período anterior |
| `SdrFunnelPanel.tsx` | **Criar** — funil com taxas entre etapas |
| `SdrTeamComparisonPanel.tsx` | **Criar** — comparação SDR vs média do time com % de diferença |
| `SdrDailyBreakdownTable.tsx` | **Reescrever** — adicionar colunas: % dia, acumulado, meta acumulada, gap acumulado, status |
| `SdrMeetingsChart.tsx` | Manter — evolução diária de barras com meta |
| `SdrRankingBlock.tsx` | Manter (incorporado ao painel de comparação) |
| `SdrPerformanceFilters.tsx` | **Criar** — filtros de período, comparação e tipo de meta |
| `useSdrPerformanceData.ts` | **Criar** — hook que orquestra dados do período atual + comparativo + cálculos de projeção |

---

### Estrutura da página (hierarquia visual)

```text
┌─────────────────────────────────────────────────────────┐
│  Header (nome, cargo, voltar)                           │
├─────────────────────────────────────────────────────────┤
│  Filtros: Período | Comparação | Tipo de Meta           │
├─────────────────────────────────────────────────────────┤
│  Resumo automático (texto dinâmico)                     │
├─────────────────────────────────────────────────────────┤
│  KPI Cards (9 cards com meta/atingimento/gap/variação)  │
├─────────────────────────────────────────────────────────┤
│  Card de Projeção                                       │
├──────────────────────────┬──────────────────────────────┤
│  Meta x Realizado x      │  Funil Individual            │
│  Projeção (barras horiz) │  (com taxas entre etapas)    │
├──────────────────────────┴──────────────────────────────┤
│  Evolução Diária (barras)  │  Evolução Acumulada (linha)│
├──────────────────────────┬──────────────────────────────┤
│  Comparação com o Time (valor, média, ranking, diff %)  │
├─────────────────────────────────────────────────────────┤
│  Tabela Diária Detalhada (com acumulado e gap)          │
└─────────────────────────────────────────────────────────┘
```

Abaixo de tudo: aba "Reuniões" com a tabela de leads (mantida).

---

### Detalhamento dos componentes novos

#### 1. `SdrPerformanceFilters.tsx`
Três select/dropdowns inline:
- **Período**: Hoje, Ontem, Últimos 7 dias, Últimos 30 dias, Este mês, Personalizado (date picker)
- **Comparação**: Sem comparação, Mesmo período mês anterior, Período anterior imediato, Personalizado
- **Meta**: Meta mensal rateada (default), Meta semanal, Meta por dia útil, Personalizada (input)

Quando muda o período, recalcula comparação automaticamente. O componente emite `{ startDate, endDate, compStartDate, compEndDate, metaMode }`.

#### 2. `useSdrPerformanceData.ts`
Hook central que:
- Chama `useSdrDetailData` para período atual
- Chama `useTeamMeetingsData` para período comparativo (segunda instância)
- Calcula meta do período: `metaDiaria × diasUteis(start, end)` via `contarDiasUteis()`
- Calcula projeção: `(realizado / diasUteisPassados) × totalDiasUteis`
- Calcula gap: `realizado - meta`
- Calcula atingimento: `realizado / meta × 100`
- Calcula variação comparativa: `(atual - anterior) / anterior × 100`
- Calcula necessário/dia: `(meta - realizado) / diasUteisRestantes`
- Calcula metas derivadas (R1 Realizada = 70% de R1 Agendada, Contratos = 30% de R1 Realizada, etc.)
- Retorna tudo tipado para os componentes consumirem

#### 3. `SdrDetailKPICards.tsx` (reescrito)
9 cards em grid responsivo. Cada card mostra:
- Título da métrica
- Valor realizado (grande, em destaque)
- Meta do período (texto menor)
- Barra de progresso (% atingimento) com cor condicional
- Gap numérico (ex: -15 em vermelho ou +5 em verde)
- Variação vs período comparativo (ex: +25% ↑ ou -10% ↓)

Métricas: Agendamentos, R1 Agendada, R1 Realizada, Contratos Pagos, Taxa Contrato, No-Show, Taxa Contato, Total Ligações, Tempo Médio.

#### 4. `SdrProjectionCard.tsx`
Card especial com layout horizontal, mostrando:
- Meta final do período
- Realizado até agora
- Projeção final (com cor: verde se ≥ meta, vermelho se <)
- Gap: quanto falta
- Necessário por dia útil restante
- Barra de progresso visual

#### 5. `SdrAutoSummary.tsx`
Bloco de texto gerado dinamicamente, ex:
> "Neste período, Carol realizou 35 agendamentos de 50 previstos, atingindo 70% da meta. Está 25% acima do mesmo período do mês anterior. Mantendo o ritmo atual, deve fechar com 98 agendamentos. Para bater a meta, precisa fazer 6,1 por dia útil restante."

Recebe todas as métricas calculadas e gera o texto com lógica condicional.

#### 6. `SdrMetaVsRealizadoChart.tsx`
Barras horizontais empilhadas para: Agendamentos, R1 Agendada, R1 Realizada, Contratos.
Cada barra mostra 3 camadas: realizado (sólido), projeção (semi-transparente), meta (outline/linha).

#### 7. `SdrCumulativeChart.tsx`
Gráfico de linha/área com 3 séries:
- Acumulado realizado (linha sólida verde/primária)
- Meta acumulada (linha tracejada)
- Acumulado do período comparativo (linha pontilhada cinza)

Eixo X = dias do período. Mostra claramente se está acima/abaixo da meta.

#### 8. `SdrFunnelPanel.tsx`
Funil vertical com 5 etapas: Ligações → Contatos → R1 Agendada → R1 Realizada → Contratos.
Entre cada etapa, mostra a taxa de conversão. Etapas com taxa baixa ficam destacadas em vermelho/amarelo.

#### 9. `SdrTeamComparisonPanel.tsx`
Tabela/cards mostrando para cada métrica principal:
- Valor do SDR
- Média do time
- Diferença % vs média
- Posição no ranking (com badge)
- Total de SDRs

Consolida o que hoje está no `SdrRankingBlock` com mais contexto.

#### 10. `SdrDailyBreakdownTable.tsx` (reescrito)
Colunas: Data | Realizado | Meta Diária | % Dia | Acumulado | Meta Acumulada | Gap Acumulado | Status.
Status com cores: verde (acima), amarelo (em linha ±10%), vermelho (abaixo).
Linha de total no final.

---

### Componentes removidos/substituídos
- `CallMetricsCards` → absorvido nos KPI cards principais (Total Ligações, Contatos/Taxa Contato, Tempo Médio)
- `SdrRankingBlock` → substituído por `SdrTeamComparisonPanel`

### Componentes mantidos
- `SdrDetailHeader` (com ajustes no período que agora vem dos filtros)
- `SdrLeadsTable` + `MeetingDetailsDrawer` (aba Reuniões)
- `SdrMeetingsChart` (evolução diária de barras)

---

### Lógica de cálculo (todas client-side)

| Cálculo | Fórmula |
|---------|---------|
| Meta período (agendamentos) | `metaDiaria × contarDiasUteis(start, end)` |
| Meta R1 Agendada | igual à meta de agendamentos (ou configurável) |
| Meta R1 Realizada | 70% da R1 Agendada atual |
| Meta Contratos | 30% da R1 Realizada meta |
| Atingimento | `realizado / meta × 100` |
| Gap | `realizado - meta` |
| Projeção | `(realizado / diasUteisPassados) × totalDiasUteisPeriodo` |
| Necessário/dia | `(meta - realizado) / diasUteisRestantes` |
| Variação comp. | `(atual - anterior) / anterior × 100` |
| Taxa Contato | `(answered / totalCalls) × 100` |
| Taxa Contrato | `(contratos / r1Realizada) × 100` |

---

### Execução

Implementação em etapas, começando pelo hook central (`useSdrPerformanceData`), depois os componentes de cima para baixo na hierarquia visual, finalizando com a integração na página.

Total: ~14 arquivos tocados, ~6 componentes novos, 1 hook novo, 3 componentes reescritos.

