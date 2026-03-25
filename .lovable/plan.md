

## Análise do Painel Comercial (BU Incorporador) — Diagnóstico completo

### O que o painel faz hoje
A página `ReunioesEquipe.tsx` (650 linhas) é o coração do acompanhamento comercial. Ela renderiza:
1. **SetorRow** — faturamento MCF Incorporador (semanal/mensal/anual)
2. **TeamGoalsPanel** — matriz Dia/Semana/Mês com 9 métricas vs metas
3. **Filtros** — Hoje/Semana/Mês/Custom + seletor de SDR + exportar Excel
4. **TeamKPICards** — 8 cards de KPI (SDRs ativos, agendamentos, realizadas, etc.)
5. **SdrSummaryTable / CloserSummaryTable** — tabelas com abas
6. **SdrActivityMetricsTable** — ligações e atividades por SDR

---

### Problemas identificados

#### 1. Inconsistência de dados entre GoalsPanel e KPI Cards (GRAVE)
Os **KPI Cards** usam `enrichedKPIs` baseado no `useR1CloserMetrics` (fonte: closers + agenda), mas o **GoalsPanel** recebe `dayKPIs`/`weekKPIs`/`monthKPIs` de `useTeamMeetingsData` (fonte: RPC de SDRs). São duas fontes de dados diferentes:

- `R1 Agendada` nos KPI Cards vem dos closers → conta attendees nos slots do closer
- `R1 Agendada` no GoalsPanel vem da RPC SDR → conta por `sdr_email`

**Resultado**: Os números da matriz de metas podem divergir dos KPI cards para a mesma métrica no mesmo período.

#### 2. Excesso de queries paralelas (PERFORMANCE)
A página dispara **~18 queries** simultâneas ao carregar:

| Query | Quantidade | Para quê |
|-------|-----------|----------|
| `useTeamMeetingsData` | ×3 (dia, semana, mês) | GoalsPanel |
| `useMeetingSlotsKPIs` | ×3 (dia, semana, mês) | GoalsPanel (NÃO USADO - dados ignorados) |
| `useR2MeetingSlotsKPIs` | ×3 (dia, semana, mês) | GoalsPanel R2 |
| `useR2VendasKPIs` | ×3 (dia, semana, mês) | GoalsPanel Vendas |
| `useR1CloserMetrics` | ×1 | KPI Cards + Closer table |
| `useMeetingsPendentesHoje` | ×1 | Pendentes hoje |
| `useSetoresDashboard` | ×1 | SetorRow faturamento |
| `useSdrsAll` + `useSdrsFromSquad` | ×2 | Dropdown + metas |

**`useMeetingSlotsKPIs`** é chamado 3 vezes (dia/semana/mês) mas seus dados **nunca são consumidos** — os valores de `dayAgendaKPIs`, `weekAgendaKPIs`, `monthAgendaKPIs` são declarados mas jamais lidos no JSX ou passados a componentes. São **3 queries completamente desperdiçadas**.

#### 3. `useR2VendasKPIs` usa fonte de dados frágil
Consulta `deal_activities.to_stage = 'Venda realizada'` — uma tabela de log que depende de movimentação no CRM, não da agenda/meeting_slots. Se alguém não mover o deal no Kanban, a venda não aparece. Inconsistente com o restante do painel que usa `meeting_slots`.

#### 4. GoalsPanel recebe dados MÊS FIXO vs filtro dinâmico
O GoalsPanel SEMPRE mostra dia/semana/mês **atuais** (hoje), independente do filtro do usuário. Se o usuário seleciona março 2025, os KPI cards mostram março, mas o GoalsPanel continua mostrando o mês corrente. Isso é intencional mas pode confundir.

#### 5. `useR1CloserMetrics` é um monólito de 477 linhas
Faz **8+ queries** internas em sequência (closers, SDRs, meetings R1, profiles, R2 meetings, ALL R1 meetings sem filtro de data, contracts by payment date, contracts without timestamp, deals, hubla_transactions, manual_sale_attributions). Isso é um risco de performance e timeout.

A query "ALL R1 meetings sem filtro de data" (linhas 147-161) busca **TODOS** os R1 meetings da história para mapear deal→closer, crescendo infinitamente.

#### 6. Fuso horário inconsistente
- `useR1CloserMetrics` aplica offset BRT (+3h) manualmente
- `useMeetingSlotsKPIs` usa `startOfDay/endOfDay` sem offset
- `useR2MeetingSlotsKPIs` usa `startOfDay/endOfDay` sem offset

Isso pode causar discrepâncias de ±1 dia entre métricas do closer e métricas do GoalsPanel.

---

### Plano de correções

#### Fase 1 — Remover desperdício imediato
1. **Remover as 3 chamadas a `useMeetingSlotsKPIs`** em ReunioesEquipe.tsx (linhas 223-227, 247) — dados nunca consumidos
2. Remover imports de `useMeetingSlotsKPIs`

#### Fase 2 — Unificar fonte de dados do GoalsPanel
3. Fazer o GoalsPanel usar os mesmos dados de `useR1CloserMetrics` para R1 Agendada/Realizada/No-Show/Contrato (pelo menos para o MÊS), garantindo consistência com os KPI Cards
4. Avaliar se `useR2VendasKPIs` deveria consultar `meeting_slot_attendees` com status `sold` em vez de `deal_activities`

#### Fase 3 — Otimizar `useR1CloserMetrics`
5. A query "ALL R1 meetings" (sem filtro de data) precisa de um limite ou cache mais agressivo — hoje busca o histórico completo em toda renderização
6. Normalizar tratamento de timezone (aplicar BRT offset em todos os hooks ou em nenhum)

---

### Resumo de impacto

| Item | Tipo | Dificuldade |
|------|------|-------------|
| Remover 3× `useMeetingSlotsKPIs` não usado | Desperdício | Fácil |
| Unificar fonte GoalsPanel ↔ KPI Cards | Inconsistência | Médio |
| Substituir `useR2VendasKPIs` (deal_activities) | Fragilidade | Médio |
| Limitar query ALL R1 em `useR1CloserMetrics` | Performance | Médio |
| Normalizar timezone | Consistência | Médio |

Deseja que eu comece pela Fase 1 (remover o desperdício) ou prefere discutir as correções de consistência primeiro?

