
# Reembolsos ancorados na data da R1 — Painel Comercial

## Objetivo
Hoje, no Painel Comercial (SDR + Closer + card pessoal), cada reembolso A000 - Contrato aparece **no dia em que o reembolso foi processado** (`refunded_at` do MCF Pay). Isso distorce a leitura do dia/semana: uma R1 feita em 10/07 que reembolsa em 22/07 "suja" o dia 22/07 e deixa o 10/07 com uma conversão irreal.

A mudança: cada reembolso passa a ser contabilizado **na data em que a R1 daquele deal foi realizada** — assim o abatimento volta para o dia da reunião que originou o contrato.

## Regras de âncora (confirmadas)

1. **Âncora principal**: `scheduled_at` da **R1 mais recente do deal** (meeting_type = 'r1', status ∈ 'completed'/'contract_paid', ordenado desc).
2. **Sem R1 registrada (outside / A010 direto)**: cair na data do `contract_paid_at` do deal e **marcar visualmente como "Outside"** no detalhamento — para você saber que aquele reembolso não teve reunião.
3. **Sem R1 e sem contract_paid**: cai no comportamento atual (data do reembolso), rotulado como "Sem âncora".

## Escopo (só Painel Comercial)
Alteração vale **exclusivamente** nas visões de performance:
- Card "Reembolsos" pessoal (SDR e Closer)
- Colunas de reembolso nas tabelas de SDR/Closer
- Cálculo de "Taxa Conv. Contrato" (Contrato Pago − Reembolsos ÷ R1 Realizada)

**Não muda** em: Financeiro → A Receber → Reembolsos, painel do MCF Pay, extratos contábeis. Lá a verdade continua sendo a data real do reembolso.

## Onde entra a mudança

- `src/hooks/useSdrRefundsInPeriod.ts` — hoje filtra `refund_mcf_pay.created_at` no intervalo do painel. Passa a: (a) buscar todos os `refund_mcf_pay` sem filtro de data, (b) para cada deal, resolver a data-âncora (R1 → contract_paid → refund), (c) filtrar pela âncora dentro do período do painel, (d) devolver o Map por SDR.
- `src/hooks/useRefundDetailsInPeriod.ts` — mesma lógica, adicionando ao payload: `anchor_date`, `anchor_source` ('r1' | 'contract_paid' | 'refund') e `is_outside` (true quando anchor_source ≠ 'r1').
- `src/hooks/useCloserRefundsInPeriod.ts` (equivalente para Closer, se existir; senão aplicar mesma lógica onde o card do Closer consome).
- Modal de detalhamento (`RefundDetailsDialog.tsx` / equivalente do print anexo): adiciona coluna/tag **"Outside"** quando `anchor_source` ≠ 'r1' e ajusta o subtítulo do período para "Período (âncora R1)".

Nenhuma migration de banco: os dados de R1 e contract_paid já existem (`meeting_slot_attendees` + `meeting_slots` + `crm_deals.contract_paid_at`).

## Como ficaria na prática (exemplo)

Reembolso do Luiz Felipe Santana em 22/07 às 18:25 → o app olha o deal do Luiz, encontra a R1 mais recente (ex.: 15/07), e o reembolso passa a contar como **15/07** nas telas de performance da SDR Caroline. Se o Luiz não tinha R1, cai em `contract_paid_at` (ex.: 20/07) marcado com tag **Outside**.

## Detalhes técnicos

- Resolução da âncora feita em uma única query paralela ao carregamento dos reembolsos: `meeting_slot_attendees` com join em `meeting_slots` filtrando `meeting_type='r1'`, agrupado por `deal_id` pegando o `MAX(scheduled_at)` onde `status IN ('completed','contract_paid')`.
- Fallback contract_paid: já vem em `crm_deals.contract_paid_at` no mesmo lote de deals que hoje é buscado no fallback do `booked_by`.
- Cache: `queryKey` mantém `[startDate, endDate]` normal; a re-âncora acontece server-side no hook, então o React Query cacheia certo.
- Dedup de `transaction_id` e inclusão dos `manual_reconciliation` continuam iguais (regra atual preservada).

## O que NÃO muda
- Regra de exclusão de parceiros/renovações.
- Atribuição por SDR (booked_by da R1 mais recente → fallback owner_id).
- Origem dos dados: MCF Pay + reconciliações manuais (Hubla replicado continua fora).
- Contabilidade / A Receber / Reembolsos em Financeiro.
