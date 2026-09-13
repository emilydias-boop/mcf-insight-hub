# Auditoria — cards do topo × linha Total da aba Closers (/crm/reunioes-equipe, 01–30/09/2026)

Somente leitura. Nada foi editado, nada publicado. Todos os números abaixo foram **reproduzidos por SQL** no mesmo recorte (01/09 a 30/09/2026, BU incorporador, sem filtro de SDR/Closer).

## 1. De onde vêm os cards do topo

- Render: `src/pages/crm/ReunioesEquipe.tsx:929` → `<TeamKPICards kpis={enrichedKPIs} segmentTotals={segmentTotals} …>`
- `enrichedKPIs` (`ReunioesEquipe.tsx:606-644`) soma **linha a linha o array `filteredBySDR`** (o mesmo array da aba SDRs):

```
const totalR1Agendada = filteredBySDR.reduce((s, r) => s + (r.r1Agendada || 0), 0);
const totalContratosCard = totalContratosSdr + (unassignedSdr.total || 0);
```

- `filteredBySDR` (`ReunioesEquipe.tsx:520-556`) = saída da RPC filtrada pela lista `activeSdrsList`, que **exclui quem tem role administrativo/closer** (`ReunioesEquipe.tsx:218`: `admin, manager, coordenador, assistente_administrativo, closer, closer_sombra`).
- Fonte dos números: `useTeamMeetingsData.ts:66` → `useSdrMetricsFromAgenda.ts:57` → RPC **`public.get_sdr_metrics_from_agenda`**.
- Quebra A/B/C dos cards: três chamadas extra da mesma RPC com `segment_filter` (`ReunioesEquipe.tsx:363-375`); "s/ICP" é **resíduo** (`total − A − B − C`), não é medido.

Tabelas e datas da RPC: `meeting_slot_attendees` + `meeting_slots` (agenda), `meeting_type='r1'`, `is_partner=false`, `status <> 'cancelled'`; BU pelo `closers.bu` do slot; data de `r1_agendada/realizada/no_show` = `(ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date`; `agendamentos` = `booked_at`; `contratos` = RPC `caucoes_efetivas(start, end, bu)`.

## 2. De onde vem a linha Total da aba Closers

- Render: `ReunioesEquipe.tsx:1032` → `<CloserSummaryTable data={closerMetrics} segmentAData={closerMetricsA} segmentBData={closerMetricsB} unassigned={unassignedCloser}>`
- Hook: **`src/hooks/useR1CloserMetrics.ts`** (`ReunioesEquipe.tsx:360`) — hook **diferente** dos cards, TypeScript no cliente, não é a RPC.
- Janela: `addHours(startOfDay/endOfDay, +3)` (offset BRT fixo), sobre `meeting_slots.scheduled_at` (`useR1CloserMetrics.ts:130-133`).
- Agregação (`useR1CloserMetrics.ts:788-864`): agrupa por `(closer_id, deal_id)`, `r1_agendada += days.size >= 2 ? 2 : 1`, `realized` se algum attendee do deal está em `completed|contract_paid|refunded`, e **`else if` no-show** (`noshow++` só quando o deal não foi realizado).
- Totais da linha Total: `CloserSummaryTable.tsx:57-80` (`reduce` das linhas exibidas). Colunas A/B: `segTotal(segmentAData|segmentBData, key)` — `CloserSummaryTable.tsx:102`.

## 3. Vem da agenda? Sim — os dois lados

| lado | fonte |
|---|---|
| cards do topo | `meeting_slots` + `meeting_slot_attendees` (agenda) via RPC; contratos via `caucoes_efetivas` (que também parte de `meeting_slot_attendees.contract_paid_at`) + `hubla_transactions` para os órfãos |
| tabela Closers | `meeting_slots` + `meeting_slot_attendees` (agenda) via queries no cliente; contratos via `caucoes_efetivas` |

Nenhum dos dois lê `deal_activities`. `crm_deals` entra só como **lookup de segmento ICP**. Logo: **a divergência é de regra, não de fonte.** As três regras responsáveis, nomeadas:

- **R1** — filtro de agendador por role: os cards descartam reuniões agendadas por quem tem role `closer`/`coordenador`/`admin`; a tabela de Closers não descarta ninguém.
- **R2** — eixo de agrupamento: cards agrupam por `(SDR, deal)`, tabela por `(closer, deal)`.
- **R3** — no-show: cards contam no-show com cap 2/deal **mesmo quando o deal também foi realizado**; a tabela usa `else if` (deal realizado nunca conta no-show).

## 4. Dedup e cap — medição

Nenhum dos lados conta linha crua. No recorte: **519 linhas de attendee**, **452 deals distintos**.

| medida | valor |
|---|---|
| linhas de attendee cruas | 519 |
| dedup `(closer, deal)` cap 2 dias | **518** |
| dedup `(agendador, deal)` cap 2 dias | 511 |
| idem, excluindo agendadores com role closer/coordenador/admin | **478** |

Prova das divergências (todas reproduzidas ao número exato):

| métrica | card | reproduzido por | tabela | reproduzido por |
|---|---|---|---|---|
| R1 Agendada A | 418 | dedup (SDR, deal) cap2 **sem** agendadores com role excluída | 446 | dedup (closer, deal) cap2, **todos** os agendadores, `icp_segment='A'` → **446** |
| R1 Agendada B | 48 | idem | 59 | → **59** |
| R1 Agendada total | 478 | → **478** | 505 (A+B) | 518 no total (A 446 · B 59 · C 12 · sem ICP 1) |
| R1 Realizada total | 277 | (SDR, deal) sem roles excluídas → **277** | 292 (A+B) | (closer, deal) → **299** total; A **257**, B **35** |
| No-show A | 122 | cap 2/deal, conta no-show mesmo em deal realizado | 108 | `else if` → **108** exatos |
| No-show total | 144 | (SDR, deal) cap2 sem roles → **144** | 127 | `else if` → **127**; sem o `else if` seriam 146 |

Ou seja: o delta de +27/+28 em agendada **não é cap nem dedup** (as duas réguas são cap 2 por dia). É o **filtro de agendador por role** (33 agendamentos feitos por closer/coordenador/admin: 511 − 478) mais as colunas A/B da tabela ignorarem C e sem-ICP. O sinal inverte no no-show porque só ali a tabela é mais restritiva (`else if`).

## 5. Segmento A/B/C — snapshot × valor atual

**Os dois lados usam o valor atual `crm_deals.icp_segment`.** A RPC: `AND UPPER(TRIM(COALESCE(cd.icp_segment,''))) = seg`. O hook de closers: `useR1CloserMetrics.ts:118-124` (`crm_deals.select('id').eq('icp_segment', segment)`). `caucoes_efetivas` também expõe `segment = cd.icp_segment`.

`meeting_slots.lead_type` (snapshot do trigger `trg_meeting_slot_herda_segmento`) **não é lido por nenhum dos dois**. Comparação no recorte:

| `icp_segment` (atual) | `lead_type` (snapshot) | R1 agendada cap2 |
|---|---|---|
| A | A | 446 |
| B | A | 59 |
| C | A | 12 |
| (null) | A | 1 |

O snapshot está gravado como `A` em 100% dos slots do mês — inútil como chave hoje. **Conclusão: a hipótese snapshot × atual está descartada**; a mesma reunião não é A num lado e B no outro.

## 6. C e s/ICP — para onde vão

- R1 Agendada: os **12 C e o 1 sem ICP** simplesmente **não aparecem** na tabela (ela só tem colunas A e B; a coluna Total os inclui — 518). Não são somados em A nem vão para "Não atribuído".
- CONTRATOS: `caucoes_efetivas` do período tem **117 linhas, 6 reembolsadas → 111 líquidas**, todas com closer e SDR: **A 94 · B 16 · C 1**. A tabela mostra A 94 · B 16 (=110) e Total 111 — bate.
- O card mostra **152** porque soma dois universos: `filteredBySDR.contratos` (105 = A 91 · B 13 · C 1, já restrito às SDRs permitidas) **+ `unassignedSdr.total`**. Esse segundo bloco é **`useUnassignedContracts.ts:120-188`**: transações `hubla_transactions` A000/CONTRATO pagas no período **sem nenhuma caução/reunião correspondente**. Medido: **47** (48 linhas, 47 após dedup por deal). Nenhuma tem segmento → viram os "s/ICP 47" do card, que é resíduo aritmético (152 − 91 − 13 − 1).
- A linha "Não atribuído" da tabela de Closers mostra Contrato Pago só com `un.a`/`un.b` (`CloserSummaryTable.tsx:106-108`): dos 47 órfãos, apenas 2 têm deal com ICP A e 1 com B — daí "A 2 · B 1". Os 44 sem segmento só apareceriam na coluna Total dessa linha. O bucket "Não atribuído" do próprio hook de closers tem `contrato_pago: 0` fixo (`useR1CloserMetrics.ts:895`).

## 7. As quatro taxas, literais

| taxa | arquivo | numerador ÷ denominador | conta |
|---|---|---|---|
| Card TAXA CONVERSÃO 54,9% | `ReunioesEquipe.tsx:640` | `totalContratosCard ÷ totalRealizadas` | 152 ÷ 277 = 54,9% |
| Card "líquida" 52,7% | `TeamKPICards.tsx:241` | `(totalContratos − totalReembolsos) ÷ realizadas` | (152 − 6) ÷ 277 = 52,7% |
| Tabela Taxa Conv. 37,1% | `CloserSummaryTable.tsx:73` | `totals.contrato_pago ÷ totals.r1_realizada` | 111 ÷ 299 = 37,1% |
| Card TAXA NO-SHOW 30,1% | `ReunioesEquipe.tsx:637` | `totalNoShows ÷ totalR1Agendada` | 144 ÷ 478 = 30,1% |
| Tabela Taxa No-Show 24,5% | `CloserSummaryTable.tsx:78` | `totals.noshow ÷ totals.r1_agendada` | 127 ÷ 518 = 24,5% |

A conversão do card e a da tabela **não são comparáveis**: o card mete 47 contratos que não têm reunião nenhuma no numerador, e usa um denominador menor (277 em vez de 299).

## 8. Resposta em uma frase

Para "quantas R1 aconteceram em setembro", a leitura certa é a da **tabela de Closers: 299** — ela conta toda reunião da agenda que teve desfecho realizado, uma vez por negócio; o card mostra **277** porque joga fora as reuniões agendadas por quem é closer/coordenador/admin (o card mede "R1 produzidas pelas SDRs do squad", não "R1 que aconteceram").

## Pendências / NÃO DETERMINADO

- Se a intenção é que reuniões agendadas por closer/coordenador contem no painel — decisão de negócio, não de código.
- Coluna Total da linha "Não atribuído" na tela não foi lida no print, só A/B; a leitura de 47 vem do código + SQL.

## Se você quiser que eu conserte (nada feito ainda)

1. Unificar R1 Agendada / Realizada / No-Show numa única régua (escolher: com ou sem agendadores de role closer) e usar nos dois lados.
2. Acrescentar colunas C e "sem ICP" na tabela de Closers, para total = soma das partes como já é nos cards.
3. Separar no card CONTRATOS "com reunião" (111) de "sem reunião" (47), em vez de somar e jogar a diferença em s/ICP.
