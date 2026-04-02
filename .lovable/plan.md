

## Reestruturação da Visão Geral do CRM — Painel Executivo de Saúde da Pipeline

### Visão geral

Substituir o `FunilDashboard` atual (focado em distribuição de estoque por etapa) por um painel executivo de gestão com 6 blocos: KPIs operacionais, saúde da pipeline, funil de fluxo, ranking SDR, ranking Closer e alertas operacionais.

A arquitetura será modular: um hook de dados principal (`useCRMOverviewData`) que faz as queries pesadas, e componentes visuais separados por bloco.

### Dados disponíveis no banco

- `crm_deals.last_worked_at` — última vez que o lead foi trabalhado
- `crm_deals.owner_id` — SDR dono (null = sem owner)
- `crm_deals.stage_moved_at` — última mudança de stage
- `crm_deals.created_at` — data de criação
- `deal_activities` — todas as atividades (stage_change, call, note, etc.)
- RPC `get_sdr_metrics_from_agenda` — métricas de agendamentos/realizadas/contratos por SDR
- `meeting_slot_attendees` + `meeting_slots` — dados de closers

### Estrutura de arquivos

```text
src/hooks/useCRMOverviewData.ts          — Hook principal (queries agregadas)
src/components/crm/overview/
  OverviewKPIs.tsx                        — 7 KPI cards principais
  PipelineHealthBlock.tsx                 — Bloco de saúde da pipeline
  FlowFunnelBlock.tsx                     — Funil real do período
  SdrRankingTable.tsx                     — Ranking operacional por SDR
  CloserRankingTable.tsx                  — Ranking por closer
  OperationalAlertsBlock.tsx             — Alertas operacionais
```

Atualizar `FunilDashboard.tsx` para compor os novos componentes.

### 1. Hook `useCRMOverviewData`

Recebe `periodStart`, `periodEnd`, `originIds[]` (da BU ativa) e executa em paralelo:

**Query A — KPIs & Pipeline Health** (direto em `crm_deals`):
```sql
-- Leads entraram no período
SELECT count(*) FROM crm_deals WHERE origin_id IN (...) AND created_at BETWEEN start AND end

-- Leads trabalhados (tem deal_activities no período)
SELECT count(DISTINCT deal_id) FROM deal_activities WHERE created_at BETWEEN start AND end AND deal_id IN (deals da BU)

-- Leads sem movimentação (abertos, last_worked_at < start OR null)
-- Leads esquecidos (abertos, last_worked_at < now - 7 dias)
-- Leads sem owner (owner_id IS NULL, abertos)
-- Leads perdidos (stage_change para stages de perda no período)
-- Total abertos, parados, envelhecidos, tempo médio
```

**Query B — Funil de fluxo** (via `deal_activities` stage_change no período):
Conta transições para cada stage no período = fluxo real.

**Query C — Ranking SDR** (via RPC `get_sdr_metrics_from_agenda` + query de `crm_deals` por `owner_id`):
Leads recebidos, trabalhados, sem movimentação, agendados, perdidos, esquecidos por SDR.

**Query D — Ranking Closer** (via `meeting_slot_attendees` + `meeting_slots`):
R1 recebidas, realizadas, no-show, contratos, R2 dados. Reutiliza lógica de `usePerformanceReport` e `useR2CloserMetrics`.

### 2. Bloco KPIs (7 cards)

| KPI | Fonte |
|---|---|
| Leads entraram | `crm_deals.created_at` no período |
| Leads trabalhados | `deal_activities` distinct deal_id no período |
| Leads avançados | `deal_activities` stage_change com `to_stage` > `from_stage` |
| Leads perdidos | Stage change para stages tipo "Perdido"/"Sem Interesse" |
| Leads sem movimentação | `last_worked_at` anterior ao período ou null |
| Leads esquecidos | `last_worked_at` < now - 7d, deal aberto |
| Leads sem owner | `owner_id IS NULL`, deal aberto |

Layout: grid 7 colunas em desktop, 2 colunas mobile. Cada card com valor + comparação vs período anterior.

### 3. Bloco Saúde da Pipeline

Card único com métricas:
- Total leads abertos
- Leads parados (sem atividade há 3+ dias)
- Leads envelhecidos (sem atividade há 7+ dias)
- Tempo médio sem movimentação
- Leads com SLA estourado (configurável por stage)
- Mini-tabela: leads travados por etapa (top 5 stages com mais leads parados)

### 4. Funil Real do Período

Barra horizontal mostrando o fluxo real (não estoque):
Entraram → Trabalhados → Qualificados → R1 Agendadas → R1 Realizadas → Contratos → R2 → Vendas

Dados via `deal_activities` stage_change contando transições para cada stage no período.

### 5. Ranking SDR (tabela)

Colunas: SDR | Recebidos | Trabalhados | Sem Mov. | Agendados | Qualificados | Perdidos | Esquecidos | Taxa Aprov.

Dados cruzando `crm_deals.owner_id` + `deal_activities` + RPC de agenda.
Ordenável por qualquer coluna. Highlight em vermelho para SDRs com muitos leads esquecidos.

### 6. Ranking Closer (tabela)

Colunas: Closer | R1 Recebidas | R1 Realizadas | No-Show | Contratos | R2 Agendadas | R2 Realizadas | Aprovados | Vendas | Taxa Conv.

Dados de `meeting_slot_attendees`/`meeting_slots` (R1 e R2).

### 7. Alertas Operacionais

Lista de alertas gerados client-side baseados nos dados já carregados:
- "X leads sem movimentação há mais de 7 dias"
- "X leads sem owner"
- "SDR [nome] com taxa de aproveitamento < 30%"
- "Closer [nome] com taxa de no-show > 40%"
- "Stage [nome] com X leads travados"

### Detalhes técnicos

- O `useCRMOverviewData` usa `useQuery` com `Promise.all` para paralelizar as queries
- Definição de "lead aberto" = `stage_id` não pertence a stages finais (Perdido, Contrato Pago, Venda Realizada). Resolvemos buscando stages com nomes que indicam estado terminal
- "Leads trabalhados" = distinct `deal_id` em `deal_activities` no período, filtrado por deals da BU
- Thresholds configuráveis: 3 dias (parado), 7 dias (esquecido), 14 dias (envelhecido)
- Mantém seletor de período (Hoje/Semana/Mês) e filtro de canal existentes
- Reutiliza componentes existentes: `KPICard`, `Card`, `Skeleton`, `Badge`, `Table`

### Arquivos afetados

1. **Criar** `src/hooks/useCRMOverviewData.ts` — Hook principal com todas as queries
2. **Criar** `src/components/crm/overview/OverviewKPIs.tsx`
3. **Criar** `src/components/crm/overview/PipelineHealthBlock.tsx`
4. **Criar** `src/components/crm/overview/FlowFunnelBlock.tsx`
5. **Criar** `src/components/crm/overview/SdrRankingTable.tsx`
6. **Criar** `src/components/crm/overview/CloserRankingTable.tsx`
7. **Criar** `src/components/crm/overview/OperationalAlertsBlock.tsx`
8. **Reescrever** `src/components/crm/FunilDashboard.tsx` — Compor os novos blocos

