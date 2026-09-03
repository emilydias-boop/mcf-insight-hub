# Inventário — relatório diário de funil por BU (somente leitura)

Nada foi alterado. Todas as afirmações abaixo têm arquivo:linha ou SELECT executado.

## Q1 — BUs que existem de fato

`select bu, count(*), count(*) filter (where is_active) from closers group by bu`:

| bu | closers | ativos |
|---|---|---|
| consorcio | 8 | 5 |
| incorporador | 19 | 12 |
| solar | 1 | 1 |
| (null) | 1 | 1 |

`bu_origin_mapping` (join com `crm_groups`/`crm_origins`):

| bu | tipo | nome | default |
|---|---|---|---|
| incorporador | origin | PIPELINE INSIDE SALES | sim |
| incorporador | origin | PILOTO ANAMNESE / INDICAÇÃO | não |
| consorcio | group | BU - LEILÃO | sim |
| consorcio | origin | Efeito Alavanca + Clube | sim |
| consorcio | origin | Cobrança Consorcio | não |
| credito | group | BU - PÓS VENDA MCF / BU - MCF CAPITAL | não |
| leilao | group/origin | BU - LEILÃO / Efeito Alavanca + Clube | não |
| solar | group | BU - MCF SOLAR | sim |
| solar | origin | PIPELINE MCF SOLAR | sim |

Enum de BU no front: `src/hooks/useMyBU.ts:5` (`incorporador | consorcio | credito | projetos | leilao | marketing | solar`).

## Q2 — Solar existe? Existe pela metade

**Existe** (não é vazio):
- Origem `PIPELINE MCF SOLAR` = `c0a10a52-...1002` e grupo `BU - MCF SOLAR` = `...1001`, mapeados em `bu_origin_mapping`.
- 19 stages próprios em `crm_stages`; **1.006 deals**, 425 criados nos últimos 30 dias.
- 1 closer ativo com `bu='solar'`; 63 slots R1 nos últimos 30 dias (última reunião 08/09/2026); 62 attendees ligados a deals solares.
- Telas: rota `/solar/crm` (`src/App.tsx:268`), layout `src/pages/crm/BUCRMLayout.tsx:51,88`, sidebar `src/components/layout/AppSidebar.tsx:196-202,413`, guard `src/components/auth/NegociosAccessGuard.tsx:34,50,61`, config `src/pages/admin/ConfiguracaoBU.tsx:22`, relatórios `src/components/relatorios/BUReportCenter.tsx:29`.

**NÃO existe, com todas as letras:**
- Nenhuma tabela própria de Solar (nenhuma migration menciona `solar`).
- Nenhuma fonte de receita/venda: `hubla_transactions` com `product_name ilike '%solar%'` = **0**; deals solares com `value > 0` = **0**.
- Consequência: "Venda Realizada", "Produção Gerada" e "Ticket Médio" de Solar **não têm origem de dado hoje**. Reunião Agendada/Realizada é o único par obtível (via attendees do closer solar) — e mesmo isso não tem hook/RPC de BU solar: `get_agenda_fatos_consorcio` filtra `fato_bu = 'consorcio'` explicitamente.

## Q3 — Incorporador: onde mora cada métrica

| Métrica | Fonte | Âncora de data |
|---|---|---|
| R01 Agendada | `meeting_slot_attendees` + `meeting_slots` (`meeting_type='r1'`, `is_partner=false`, `status<>'cancelled'`) — RPC `get_daily_view_incorporador` e `get_sdr_metrics_from_agenda`; front `src/hooks/useR1CloserMetrics.ts` | dois eixos convivem: **`booked_at`** (ato de agendar; SDR) e **`scheduled_at`** (dia da reunião) |
| R01 Realizada | mesma base, `status in ('completed','contract_paid','refunded')` (RPC diária) — o card de equipe usa os três status | `scheduled_at` em `America/Sao_Paulo` |
| Contrato Pago | `src/hooks/useR1CloserMetrics.ts:358-402,672-714` — verdade = `contract_paid_at IS NOT NULL`, com fallback `scheduled_at` quando `status='contract_paid'` sem data, mais atribuições manuais (`manual_sale_attributions`) | **`contract_paid_at`** |
| R02 Agendada / R02 Realizada | `src/hooks/useR2MeetingSlotsKPIs.ts:40-78` (`meeting_type='r2'`; agendada = tudo menos `cancelled`/`rescheduled`; realizada = `completed`/`contract_paid`/`refunded`) | `meeting_slots.scheduled_at` (com hack de +3h BRT, linhas 33-36) |
| Venda Realizada | `src/hooks/useR2VendasKPIs.ts:19-24` — conta `deal_activities` com `to_stage='Venda realizada'` | **`deal_activities.created_at`** (dia do lançamento, não da venda) |
| Faturamento Líquido | **existe no sistema**: `src/hooks/useChannelFunnelReport.ts:684-742` soma `hubla_transactions.product_price` (bruto = `reference_price` do catálogo). Config: `src/components/relatorios/funnelMetricsConfig.ts:56-66` | **`hubla_transactions.sale_date`** |
| Ticket Médio | **não existe cálculo próprio** para Incorporador — no funil de canais só há `faturamentoBruto`/`faturamentoLiquido` e `vendaFinal`; seria derivado (faturamento ÷ vendas) |

Observação: `get_daily_view_incorporador` (RPC de 1 dia) só entrega **agendamentos por SDR**, **reuniões realizadas** e **contratos pagos** por closer — não tem R02, venda, faturamento nem ticket.

## Q4 — Consórcio: confirmação

- Reunião Agendada/Realizada: `src/hooks/useConsorcioAgendaFatos.ts` → RPC `get_agenda_fatos_consorcio`. Fatos `agendada`/`realizada`/`no_show`/`fechada_agenda` ancoram no **dia da reunião**; `agendamento` ancora em **`booked_at`**. Dedup 1 por deal+dia e cap 2 por deal na janela; BU do fato = `closers.bu` do slot.
- Venda Realizada = clientes distintos via `clienteKey(card)` (`src/hooks/useConsorcioCotasContratadas.ts:201`). Confirmado.
- Produção Gerada: `src/hooks/useConsorcioProducaoGerada.ts` — três pernas: proposta (`coalesce(aceite_date, proposal_date)`), cadastro sem proposta (`aceite_date`, linhas 418-423), cota histórica (`data_contratacao`).
- Cotas Contratadas: `src/hooks/useConsorcioCotasContratadas.ts:248-254` — `consortium_cards` por **`data_contratacao`**.
- **"Consórcios Efetivados"**: sim, é a coluna "Consórcio Efetivado" de `src/components/sdr/ConsorcioCloserSummaryTable.tsx:228-232` — é o **crédito** das cotas contratadas, `creditoByCloser` = soma de `consortium_cards.valor_credito` (linhas 35-36, 124), com `creditoSemCloser` no total (linha 137). O tooltip da linha 232 confirma: "Consórcio Efetivado ÷ Vendas Realizadas".

## Q5 — Funcionam para UM DIA?

**Naturalmente diárias (dia anterior é estável):**
- Incorporador: R01 Agendada (por `booked_at`), R01 Realizada, R02 Agendada/Realizada, Contrato Pago (`contract_paid_at`), Faturamento Líquido (`sale_date`).
- Consórcio: Reunião Agendada / Realizada (dia da reunião).

**Onde o relatório do dia anterior mentiria:**
- **R01/R02 Realizada** — status de attendee é editado depois (`completed`, `no_show`, `refunded`). Rodar às 8h de D+1 pega muita reunião ainda sem tabulação; o número muda nos dias seguintes.
- **Contrato Pago** — o fallback por `scheduled_at` (quando `status='contract_paid'` sem `contract_paid_at`) e as atribuições manuais são lançados retroativamente.
- **Venda Realizada (Incorporador)** — ancorada em `deal_activities.created_at`, ou seja **dia do lançamento**, não da venda. É estável, mas não corresponde ao dia real do negócio.
- **Produção Gerada (Consórcio)** — é a pior para D-1: âncora `aceite_date`/`data_contratacao` pode ser retroativa. O próprio hook mantém sinalizadores de **antedatação** e de **lançados retroativos** (`useConsorcioProducaoGerada.ts:42-60`), e a regra é mensal ("nunca sai desse mês"). Um recorte de 1 dia é legítimo mas volátil.
- **Cotas Contratadas / Consórcios Efetivados** — `data_contratacao` chega com atraso (a contratação é registrada dias depois do aceite). O dia anterior quase sempre vem subestimado.
- **Faturamento Líquido** — estorno/reembolso posterior altera o passado.
- **Dedup e cap 2** do consórcio: em janela de 1 dia o cap praticamente não morde, então o total diário somado ≠ total semanal calculado com cap.
- **Solar** — todas as métricas de venda/produção mentiriam porque não existe fonte.

## Q6 — O que já existe pronto

**Por dia:**
- RPC `get_daily_view_incorporador(p_date, ...)` + `src/hooks/useDailyViewIncorporador.ts` + tela `src/components/relatorios/DailyViewPanel.tsx`, exposta em `src/pages/bu-incorporador/Relatorios.tsx:7` (`daily_view`). Só Incorporador, só SDR-agendamentos / closer-reuniões / closer-contratos, com overrides em `daily_view_overrides`.
- Outras RPCs de dia: `get_sdr_daily_bookings`, `get_closer_daily_meetings`, `get_closer_daily_contracts`, `get_sdr_call_daily_summary`, `operacional_incorporador_daily(p_from, p_to)`.
- Nenhuma tela/export de "resumo diário do funil por BU" com as métricas pedidas.

**Envio já configurado (reaproveitável):**
- `supabase/functions/weekly-bu-report/index.ts` — semanal sábado→sexta, lê `weekly_metrics`, monta HTML e envia por `brevo-send` (linha 141) para `grimaldo.neto@...` (linha 9). Tem entrada em `supabase/config.toml:231`.
- `supabase/functions/weekly-manager-report/index.ts` (1.224 linhas) — também envia por `brevo-send` (linhas 1174, 1196).
- `supabase/functions/brevo-send` — transporte de e-mail existente.
- WhatsApp: `twilio-whatsapp-send`, `send-boleto-whatsapp`. Webhooks de saída: `outbound-webhook-dispatcher`.

## Veredito do inventário

- **Dá para fazer hoje, com fonte existente:** Incorporador completo, exceto Ticket Médio (derivado) — e ciente da volatilidade de D-1. Consórcio completo (reuniões, vendas, produção, cotas, crédito efetivado), com as ressalvas de retroatividade.
- **Precisa ser construído:** agregação diária por BU num único lugar (hoje as métricas estão espalhadas em hooks de front, não em RPC), Ticket Médio, e o recorte diário de Consórcio (os hooks são de janela/mês).
- **Não existe:** qualquer fonte de venda, produção ou ticket para **Solar**; e qualquer relatório diário de funil por BU (o que existe é semanal por e-mail e a Visão Diária só do Incorporador).
