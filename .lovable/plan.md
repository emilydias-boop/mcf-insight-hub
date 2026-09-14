# Agenda R1 × Painel Comercial — medição da distância (setembro/2026, BU incorporador)

Modo leitura. Nada foi editado no código nem no banco.

**Resposta curta:** a distância é de **1 linha** em R1 Agendada e **28 no-shows**. R1 Realizada é **idêntica**. O painel já lê exatamente as mesmas tabelas da Agenda R1.

## 1) O que a tela da Agenda R1 lê

Arquivos: `src/pages/crm/Agenda.tsx` (tela), `src/hooks/useAgendaData.ts` → `useAgendaMeetings` (dados), `src/components/crm/MeetingsList.tsx` (Lista), `AgendaCalendar.tsx` (Calendário), `CloserColumnCalendar.tsx` (Por Closer).

`useAgendaMeetings` (useAgendaData.ts:158-298):

- Tabela: `meeting_slots` + embed `meeting_slot_attendees` (+ `closers`, `crm_deals`, `crm_contacts`, `profiles`).
- Coluna de data: `meeting_slots.scheduled_at` (`gte`/`lte` do range da tela).
- `meeting_type = 'r1'` (default; a aba R1 nunca traz R2).
- BU: `closerIds` vindo de `useClosersWithAvailability(bu)` → `closers.bu` (Agenda.tsx:137-144); inclui closers inativos que tenham reunião no período.
- **Sem filtro de status, sem `is_partner` no SQL, sem dedup, sem cap.**

Na tela (Agenda.tsx:159-233): esconde só slot cancelado **sem participante** (`status === 'canceled' && attendees.length === 0`); filtro de status é opcional e roda no nível do attendee; `is_partner` é excluído das buscas/contagens de lead.

**Resposta direta:** a Lista mostra **uma linha por attendee** (`MeetingsList.tsx:128-171` faz um loop por attendee, pulando `is_partner`); Calendário e Por Closer mostram o slot com os attendees listados dentro. Não há agrupamento por deal em lugar nenhum.

## 2) Contagem literal da agenda × painel (01–30/09/2026)

| medida | contagem literal da agenda | painel hoje |
|---|---|---|
| R1 na agenda (linhas de attendee, não-sócio) | **519** | 518 |
| realizadas (`completed`+`contract_paid`+`refunded`) | **299** | 299 |
| no-show | **155** | 127 |

Universo cru por status (todas as linhas de attendee dos slots R1 do incorporador no período):

| status | linhas |
|---|---|
| completed | 190 |
| no_show | 155 |
| contract_paid | 109 |
| invited | 58 |
| rescheduled | 7 |
| scheduled | 0 |
| refunded | 0 |
| cancelled / canceled | 0 |
| **total** | **519** |

Sócios (`is_partner = true`): 0 no período. Attendee sem `deal_id`: 0. Slots cancelados no período: 6 — todos **sem attendee** (a tela também os esconde), logo não afetam contagem nenhuma.

## 3) Onde cada regra do painel morde

- **cap 2 por (closer, deal)** — impacto **1 linha**. 519 → 518. Só 1 par tem 2 linhas no mesmo dia; nenhum par tem mais de 2 dias distintos.
  - A linha: deal `16d1f506…` — **Sandra Mara de Alcântara - A010**, closer **Rodrigo dos Santos Martinho**, 10/09 12:30 `no_show` e 10/09 14:30 `completed`. Mesmo dia, mesmo closer → o painel conta 1.
- **`else if` de no-show** — impacto **19**. 146 pares com no-show, dos quais 19 também têm reunião realizada → o painel não conta esses. (E antes disso, a dedup 1-por-par já leva 155 linhas → 146 pares.) Somando: 155 → 146 (dedup) → **127** (else if).
- **filtro de status** — impacto **0**. O painel aceita `scheduled, invited, completed, no_show, contract_paid, refunded, rescheduled`; o universo do período só tem statuses dessa lista.
- **Realizada** — impacto **0**: 299 linhas cruas = 299 pares (closer, deal) com realizada. Coincidência aritmética do mês, não garantia estrutural.

Reproduzi os três números do painel exatamente em SQL (518 / 299 / 127) usando a régua de `useR1CloserMetrics` (cap 2 por dias distintos, 1 realizada por par, `else if` no no-show).

## 4) O que NÃO vem da Agenda R1

| card / coluna | fonte |
|---|---|
| AGENDAMENTOS | Agenda R1 (`meeting_slot_attendees.booked_at`, eixo do ato de agendar) |
| R1 AGENDADA | Agenda R1 (`scheduled_at`) |
| R1 REALIZADA | Agenda R1 |
| NO-SHOWS | Agenda R1 |
| Pendentes | derivado da Agenda R1 (agendada − realizada − no-show) |
| CONTRATOS | **não** — RPC `caucoes_efetivas` + `hubla_transactions` + `manual_sale_attributions` |
| OUTSIDE | **não** — `hubla_transactions` (venda sem R1) |
| REEMBOLSOS (nº e R$) | **não** — `caucoes_efetivas` (`refunded_at`, `valor`) |
| TAXA CONVERSÃO | mista — numerador fora da agenda (contratos), denominador na agenda |
| TAXA NO-SHOW | Agenda R1 |
| Tabela Closers: R1 Agendada / Realizada / No-show | Agenda R1 |
| Tabela Closers: R2 Agendada | **não** — `meeting_slots` com `meeting_type = 'r2'` (outra tela) |
| Tabela Closers: Contrato Pago | **não** — `caucoes_efetivas` |
| Tabela Closers: Outside / Reembolsos / Taxa Conv. | **não** (ou mista, como acima) |
| Segmento A/B/C/s-ICP | `crm_deals.icp_segment` (valor atual, mutável) — não é campo da agenda |

Além dos dois que você já sabia, entram nessa lista: **OUTSIDE**, **REEMBOLSOS** (e o valor em R$), **TAXA CONVERSÃO** (numerador) e a **segmentação ICP**.

## 5) Conclusão

Se o painel passar a contar a agenda literalmente, **quase nada muda: R1 Agendada vai de 518 para 519 (+1, a linha da Sandra Mara), R1 Realizada continua 299, e No-shows sobe de 127 para 155 (+28) — sendo que 19 desses 28 são leads que deram no-show e depois foram atendidos no mesmo mês, e 9 são duas marcações de no-show do mesmo lead com o mesmo closer.** O painel já lê `meeting_slots` + `meeting_slot_attendees`, com o mesmo `meeting_type='r1'`, o mesmo recorte de BU por `closers.bu` e a mesma coluna de data; a única decisão de negócio real é se um lead que faltou e depois compareceu deve aparecer nas duas colunas (agenda literal) ou só na de realizada (painel hoje) — e é essa decisão, não a fonte de dados, que move a TAXA NO-SHOW entre 24,5% e 29,9%.

`NÃO DETERMINADO`: se contar duas vezes o mesmo lead/closer no mesmo dia (o caso Sandra Mara) é o comportamento desejado, ou se essa segunda linha é erro operacional de marcação.
