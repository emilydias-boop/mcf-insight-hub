# Mapeamento técnico — Segmento Lead A / Lead B (BU Incorporador)

Levantamento apenas (nenhum arquivo de produto alterado). Abaixo o que existe hoje, onde cabe o filtro por segmento e o custo de cada opção.

## 1. Painel Comercial / Reuniões Equipe

Rota: `/crm/reunioes-equipe` (arquivo `src/pages/crm/ReunioesEquipe.tsx`, 1039 linhas).

Fontes de número de cada bloco:

| Bloco | Hook | Origem real |
|---|---|---|
| KPIs de topo (Agendamentos, R1 Agendada, R1 Realizada, No-Show, Contrato, Reembolsos) | `useTeamMeetingsData` → `useSdrMetricsFromAgenda` | RPC `get_sdr_metrics_from_agenda(start,end,sdr_email_filter,bu_filter)` → retorna **JSON já agregado** |
| Tabela por SDR (`SdrSummaryTable`) | mesmo RPC + `useSdrMeetingsFromAgenda` | RPC `get_sdr_meetings_from_agenda_aligned` → linhas por attendee (tem `deal_id`, **não tem tags**) |
| Tabela por Closer + KPI CONTRATOS | `useR1CloserMetrics` | consultas diretas em `meeting_slots`, `meeting_slot_attendees`, `hubla_transactions`, `deal_activities`, `crm_deals` |
| R2 Agendada / R2 Realizada / Venda | `useR2MeetingSlotsKPIs`, `useR2VendasKPIs` | consultas em `meeting_slots` / vendas |

Consequência: os KPIs de topo e a tabela de SDR vêm de um agregado do banco que **não conhece tags**. A tabela de Closer e as linhas de reunião trabalham em nível de registro (com `deal_id` em mãos), então aceitam segmentação no cliente.

Ponto natural para adicionar o segmento, sem tocar nos totais atuais:
- Um seletor "Segmento: Todos | Lead A | Lead B" no header do painel, funcionando como **filtro aditivo de camada de apresentação**: com "Todos" nada muda (números idênticos aos de hoje); ao escolher Lead A/B, recalcula os KPIs a partir das linhas de attendee (`get_sdr_meetings_from_agenda_aligned` + attendees do `useR1CloserMetrics`) cruzadas com um mapa `deal_id → segmento`.
- Alternativa mais barata visualmente: manter os totais como estão e mostrar, ao lado de cada KPI, uma quebra "A / B" apenas informativa, sem alterar o número principal.

## 2. Relatórios da BU Incorporador que mostram o mesmo funil

Rota: `/bu-incorporador/relatorios` → `src/pages/bu-incorporador/Relatorios.tsx` → `src/components/relatorios/BUReportCenter.tsx`, com os relatórios: `daily_view, contracts, sales, carrinho, acquisition, investigation, nao_comprou, controle_diego, carrinho_analysis`.

Painéis que exibem o funil Agendamento → R1 Agendada → R1 Realizada → No-Show → Contrato Pago → R2 Agendada:

| Tela | Arquivo | Hook / fonte |
|---|---|---|
| Aquisição (funil por canal) | `src/components/relatorios/AcquisitionReportPanel.tsx` + `ChannelFunnelTable.tsx` + `funnelMetricsConfig.ts` | `src/hooks/useChannelFunnelReport.ts` (queries diretas, **já lê `crm_deals.tags`**) |
| Visão Diária | `src/components/relatorios/DailyViewPanel.tsx` | RPC `get_daily_view_incorporador` (JSON agregado, sem tags) |
| Performance (SDR/Closer) | `src/components/relatorios/PerformanceReportPanel.tsx` | reaproveita `SdrSummaryTable` / métricas de agenda |
| Investigação | `src/components/relatorios/InvestigationReportPanel.tsx` | `useInvestigationReport` |
| Carrinho / Carrinho Analysis | `CarrinhoReportPanel.tsx`, `CarrinhoAnalysisReportPanel.tsx` | `useCarrinhoAnalysisReport` |
| Pós-venda | `PostSaleFunnelPanel.tsx` | tracking pós-contrato |

Fora de Relatórios, mas com o mesmo funil:
- `/crm/movimentacoes-estagio` → `src/pages/crm/MovimentacoesEstagio.tsx` + `BUFunnelComplete.tsx` / `useBUFunnelComplete.ts` (**já lê e filtra por `crm_deals.tags`**)
- `/crm/overview` → `FunilDashboard.tsx`
- `/{bu}/crm/agenda/metricas` → `src/pages/crm/AgendaMetricas.tsx`

## 3. Disponibilidade de `crm_deals.tags`

- **Barato (tags já na query):** `useChannelFunnelReport` e `useBUFunnelComplete` já selecionam `id, tags, origin_id, ...` de `crm_deals` — dá para derivar o segmento sem nenhuma query nova.
- **Custo baixo (1 query extra):** painel comercial e demais painéis que trabalham por attendee já têm `deal_id`; basta um `select id, tags from crm_deals in (deal_ids)` em lote (padrão `batchedIn` já usado em `useR1CloserMetrics`) e um `Map<deal_id, 'Lead A'|'Lead B'>`.
- **Caro / exige SQL:** o que vem de RPC agregado (`get_sdr_metrics_from_agenda`, `get_daily_view_incorporador`, `get_channel_funnel_metrics`) não expõe tags nem `deal_id`; segmentar ali exige novo parâmetro na função do banco ou recalcular no cliente a partir das linhas de attendee.

## Observações dos dados atuais (verificado no banco)

- Deals com tag Lead A/Lead B: **9.484 no total**; dentro das duas origens Incorporador informadas (`e3c04f21…`, `7431cf4a…`): **251 Lead A / 85 Lead B**. Ou seja, a maior parte das tags está em deals de outras origens — vale confirmar se o trigger deveria ser restrito à BU Incorporador ou se essas outras origens também são Incorporador.
- `crm_deals.lead_income_estimate` está **NULL em 100% das linhas** (0 registros preenchidos, inclusive fora da BU). Portanto qualquer UI que dependa do valor de renda ainda não teria dado; a segmentação hoje só é confiável via tag.

## Próximo passo sugerido

Escolher o escopo da fase 1 entre:
1. Só painel comercial (`/crm/reunioes-equipe`) com seletor de segmento; ou
2. Só relatório de Aquisição (funil por canal), que é o de menor custo técnico por já ter as tags em mãos; ou
3. Os dois, com um helper compartilhado `resolveLeadSegment(tags)` reaproveitado do que já existe no Kanban e na Agenda.
