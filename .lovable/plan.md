# Auditoria somente-leitura — /crm/reunioes-equipe (setembro/2026)

Nada foi alterado no código nem no banco. Todos os números abaixo vieram de leitura de código + consultas SELECT.

## 1. Por que o total do card não é A + B

Os cards têm **duas fontes diferentes**:

- O número grande vem de `filteredBySDR` (RPC `get_sdr_metrics_from_agenda` **sem** filtro de segmento) — `src/pages/crm/ReunioesEquipe.tsx:605-642`.
- A linha "A: … · B: …" vem de duas chamadas separadas da mesma RPC com `segment_filter='A'` e `'B'` (`ReunioesEquipe.tsx:365-370`, somadas em `segmentTotals`, linhas 575-598).

A RPC filtra por `UPPER(TRIM(crm_deals.icp_segment)) = 'A'|'B'`. Em setembro/2026 (R1, BU incorporador, sem canceladas) o banco tem:

| icp_segment | reuniões (attendees) | negócios |
|---|---|---|
| A | 394 | 342 |
| B | 59 | 54 |
| **C** | **15** | **11** |
| nulo | 1 | 1 |

Ou seja: existe um terceiro segmento (**C**) e um negócio sem segmento. O total inclui C + nulo; a linha A/B não. Recomputando a RPC por segmento (mês inteiro, sem o recorte de squad da tela):

| métrica | total | A | B | C | A+B+C+nulo = total? |
|---|---|---|---|---|---|
| agendamentos | 402 | 339 | 52 | 10 | sim (≈, +1 nulo) |
| r1_agendada | 461 | 388 | 59 | 13 | sim |
| r1_realizada | 265 | 228 | 31 | 6 | sim |
| no_shows | 131 | 111 | 14 | 5 | sim |
| contratos | 99 | 84 | 14 | 1 | sim |

**Veredito: comportamento correto na origem, apresentação enganosa.** As diferenças que o dono viu (371−361=10, 428−415=13, 245−239=6, 125−119=6) são exatamente o volume de segmento C + nulo. O componente `MeetingSummaryCards` até calcula "Sem ICP: total−A−B" (`src/components/sdr/MeetingSummaryCards.tsx:68-77`), mas rotula como "Sem ICP" o que na verdade é **C + sem ICP** — daí a leitura de "não bate".

Os valores da tela (371/428/245/125) são menores que os brutos (402/461/265/131) porque a página restringe a SDRs do squad no período e exclui quem tem cargo admin/manager/coordenador/closer (`ReunioesEquipe.tsx:200-242, 522-542`). Isso é intencional.

## 2. Contratos e Taxa de Conversão — divergência real (eixos diferentes)

- Card **Contratos = A + B do eixo CLOSER**: `segmentTotals` usa `closerMetricsA/closerMetricsB` (`useR1CloserMetrics`, agregação em JavaScript, `src/hooks/useR1CloserMetrics.ts`), somando só `contrato_pago` (`ReunioesEquipe.tsx:590-596, 619-621`). 84 + 14 = **98**. O segmento C (1 contrato) fica de fora do card.
- Tabela de SDRs: contratos vêm do **eixo SDR** (RPC, via `caucoes_efetivas` + e-mail do SDR da última R1) e ainda são restritos à lista de SDRs válidos; contratos sem SDR reconhecido caem na linha "Não atribuído" (`useUnassignedContracts`).
- Taxa: o card mostra a taxa **bruta** `contratos / realizadas` (`ReunioesEquipe.tsx:638-640` → 98/245 = 40,0%); a linha de total da tabela mostra a taxa **líquida** `(contratos − reembolsos) / realizadas` (`src/components/sdr/SdrSummaryTable.tsx:475-481` → 37,1%).

**Veredito: divergente por definição inconsistente.** Card e tabela nunca vão fechar enquanto um usar eixo closer/taxa bruta e o outro eixo SDR/taxa líquida.

## 3. Outros períodos (recomputado pela mesma RPC, BU incorporador, sem recorte de squad)

| período | agend. | R1 agendada | realizada | no-show | pendentes | contratos |
|---|---|---|---|---|---|---|
| Hoje 11/09 | 1 | 42 | 1 | 0 | 41 | 1 |
| Semana 05–11/09 | 181 | 230 | 113 | 75 | 42 | 42 |
| Custom 01–10/09 | 401 | 414 | 264 | 131 | 20 | 98 |
| Mês 01–30/09 | 402 | 461 | 265 | 131 | 65 | 99 |

Fuso e limites de dia estão consistentes: a RPC converte tudo com `AT TIME ZONE 'America/Sao_Paulo'` e usa `effective_end = LEAST(end, hoje_SP)` para realizada/no-show/agendamentos/contratos, enquanto R1 Agendada usa a janela cheia (planejamento). Por isso 01–10/09 tem quase o mesmo "agendamentos" do mês (o corte é hoje, 11/09) e "Hoje" mostra 41 pendentes (reuniões do dia ainda sem desfecho). Comportamento correto.

## 4. Predicado de "R1 realizada" e exclusividade

`get_sdr_metrics_from_agenda` conta como realizada o negócio com attendee em `('completed','contract_paid','refunded')` — flag máxima por (SDR, negócio), não por dia.

- **Diverge da regra oficial da edge function** `ote-consorcio-metrics`, que usa apenas `completed` + `contract_paid`. Aqui entra também **`refunded`**. Definição a decidir pelo dono.
- No-show é contado **por dia** com cap (1 antes de 01/05/2026, 2 depois); realizada é 0/1 por negócio.
- Pendentes = `GREATEST(r1_agendada − realizada − no_shows, 0)`. Como as três usam chaves e caps diferentes, **não são mutuamente exclusivas**: um negócio com um dia de no-show e outro dia realizado entra nas duas contagens, e o `GREATEST(...,0)` esconde o estouro. A página ainda reconcilia a diferença jogando o resto em "vencidas" (`ReunioesEquipe.tsx:689-697`), o que mascara o problema em vez de expô-lo.

## 5. Relatório final

| Card | Exibido | Recomputado | Veredito | Causa / local |
|---|---|---|---|---|
| Agendamentos | 371 (A322·B39) | total inclui C(10)+nulo | correto, rótulo enganoso | `ReunioesEquipe.tsx:605-642` vs `365-370`; rótulo em `MeetingSummaryCards.tsx:68-77` |
| R1 Agendada | 428 (A369·B46) | C = 13 | correto, rótulo enganoso | idem |
| R1 Realizada | 245 (A216·B23) | C = 6; inclui `refunded` | definição a decidir | RPC `get_sdr_metrics_from_agenda`, CTE `dedup_realizada` |
| No-Shows | 125 (A107·B12) | C = 5 | correto, rótulo enganoso | CTE `noshow_per_lead` (cap por dia) |
| Pendentes | reconciliado | aritmético, não exclusivo | divergente | RPC `pendentes` + `ReunioesEquipe.tsx:689-697` |
| Contratos | 98 (A84·B14) | eixo closer; SDR dá 99 (A84·B14·C1) | divergente (eixos diferentes) | `ReunioesEquipe.tsx:590-596, 619-621` vs `useUnassignedContracts` |
| Taxa Conversão | 40,0% | 98/245 bruta; tabela usa líquida 37,1% | divergente por definição | card `ReunioesEquipe.tsx:638-640`; tabela `SdrSummaryTable.tsx:475-481` |
| Taxa No-Show | — | `no_shows / r1_agendada`, bases com caps diferentes | consistente entre card e tabela | `ReunioesEquipe.tsx:635-637`, `SdrSummaryTable.tsx:104-105` |

## Decisões que dependem do dono (nada foi mexido)

1. "R1 realizada" deve continuar contando `refunded` nesta tela, ou alinhar com a regra oficial (`completed` + `contract_paid`)?
2. O card Contratos deve virar eixo SDR (fechando com a tabela) ou a tabela deve virar eixo closer?
3. A taxa do card deve ser bruta ou líquida (descontando reembolsos), para bater com a tabela?
4. A linha do card deve passar a mostrar "A · B · C · Sem ICP" (hoje C é somado dentro de "Sem ICP")?
