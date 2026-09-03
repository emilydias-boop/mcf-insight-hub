# Auditoria somente-leitura: R1 Realizada 69 x 44 (BU Incorporador, set/2026)

Nada foi alterado. Apenas SELECT + leitura de código. Todos os números abaixo foram medidos hoje (03/09/2026, ~11:41 America/Sao_Paulo) e reproduzem exatamente os valores da tela.

## 1) Predicado EXATO do card "R1 REALIZADA" (69)

Cadeia: `src/pages/crm/ReunioesEquipe.tsx` → `useTeamMeetingsData` → `useSdrMetricsFromAgenda` → RPC `public.get_sdr_metrics_from_agenda`.

Card renderizado em `src/components/sdr/TeamKPICards.tsx:142-151` (`value: kpis.totalRealizadas`, `segLine: segLineFor('r1Realizada')`).

Valor somado no front em `src/pages/crm/ReunioesEquipe.tsx:643`:
`const totalRealizadas = filteredBySDR.reduce((s, r) => s + (r.r1Realizada || 0), 0);`

Ou seja: **soma por SDR**, e não contagem de deals. `filteredBySDR` (linhas 566-576) restringe às SDRs elegíveis do período:
`activeSdrsList` = `get_sdrs_for_squad_in_period('incorporador', ...)` menos `nonSdrEmails` (perfis com role admin/manager/coordenador/assistente_administrativo/closer/closer_sombra — linhas 223-241, 250-261).

Predicado no banco (`get_sdr_metrics_from_agenda`, CTEs `raw_attendees` e `dedup_realizada`):

- Tabelas: `meeting_slot_attendees msa` INNER `meeting_slots ms`, LEFT `closers cl` (via `ms.closer_id`), LEFT `profiles p_booker` (via `msa.booked_by`), LATERAL `sdr` + `sdr_squad_history`, LEFT `crm_deals cd`.
- Filtros: `msa.status <> 'cancelled'`, `ms.meeting_type = 'r1'`, `msa.is_partner = false`, `p_booker.email IS NOT NULL`, e BU = `sdr_squad_history.squad = 'incorporador'` **na data do agendamento** OU (squad nulo E `cl.bu = 'incorporador'`).
- **Não há filtro de origin_id/pipeline.** A BU vem do squad de quem agendou, não da origem do negócio.
- Eixo de data: `meeting_day = (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date`, entre `start_d` e `effective_end = LEAST(end_d, hoje_SP)`. Com filtro 01/09–30/09 hoje, a janela real de "realizada" é **01/09–03/09**.
- Unidade de contagem: `GROUP BY sdr_email, deal_id` com `MAX(CASE WHEN status IN ('completed','contract_paid','refunded') THEN 1 ELSE 0 END)`. Ou seja **pares (SDR, negócio)** — não attendees, não slots. `refunded` e `contract_paid` contam como realizada.
- Status que saem: `cancelled` (attendee). `rescheduled` não é excluído do universo (só não conta como realizada). O status do **slot** é ignorado.
- Lead A/B: `UPPER(TRIM(crm_deals.icp_segment)) = 'A' | 'B'`, via duas chamadas extras da mesma RPC com `segment_filter` (`ReunioesEquipe.tsx:609-632`). Negócio com `icp_segment` vazio/nulo entra no total e **não** aparece em A nem em B.

Medição de hoje: 78 pares no predicado bruto; 9 descartados pelo filtro de SDR (nicola.ricci 3, rodrigo.martinho 3, bruno.albuquerque 2, jessica.bellini 1) → **69**. Segmentos: A 64−6 = **58**, B 7−1 = **6**, sem segmento 7−2 = **5**. 58+6+5 = 69.

## 2) Predicado da edge function (44)

`supabase/functions/ote-consorcio-metrics/index.ts:109-180`, bloco `incorporador_50k` (linhas 248-255):

- `meeting_slot_attendees` INNER `meeting_slots` (`meeting_type='r1'`, `scheduled_at` no mês inteiro) INNER `crm_deals` com `origin_id IN (PIPELINE INSIDE SALES, PILOTO ANAMNESE/INDICAÇÃO)`.
- Exclui `cancelled/canceled/cancelada/rescheduled/remanejada` **no attendee E no slot** (`STATUS_EXCLUIDOS`, linhas 33-39, 146-150).
- Realizada = `attendee.status === 'completed'` apenas, contando **deals distintos** (linhas 166-173).
- Sem filtro de `is_partner`, sem filtro de agendador/squad, janela do mês completo (não corta em hoje).

## 3) A ponte, fechando exata

```text
69   card R1 REALIZADA (pares SDR x deal, SDRs elegíveis)
-25  negócios cuja única marca é contract_paid / refunded
     (a function só aceita status='completed')
- 5  negócios de origem "Efeito Alavanca + Clube"
     (o card não filtra origem; a function só aceita as 2 origens do 50K)
+ 5  negócios cujo agendador o card descarta e a function não:
     nicola.ricci 3, rodrigo.martinho 1, jessica.bellini 1
     (todos completed, origem INSIDE SALES, dia 01-02/09)
----
44   ote-consorcio-metrics.incorporador_50k.r1_realizadas
```

Conferência direta dos conjuntos: 30 negócios estão só no card, 5 estão só na function (`69 − 30 + 5 = 44`).

Parcelas com contribuição **zero** hoje, mas que são divergências estruturais reais (podem abrir em outro mês):
- Deals com mais de um attendee `completed` — hoje 0 (78 pares = 78 deals distintos; nenhum negócio agendado por dois SDRs no período).
- Eixo de data: o card corta em hoje (03/09) e a function vai até 30/09 — hoje não há realizada com `scheduled_at` em 04-05/09 nas 2 origens (existem slots nesses dias, mas nenhum `completed`).
- Slot `cancelled/rescheduled` com attendee `completed` (a function exclui, o card não): 0 no período.

### Card 69 x Total da tabela de Closers (64 + 7 = 71)

A tabela de Closers vem de `useR1CloserMetrics` (`src/hooks/useR1CloserMetrics.ts:182-215, 788-848`) e a linha Total das colunas A/B usa `segTotal(segmentAData) / segTotal(segmentBData)` (`src/components/sdr/CloserSummaryTable.tsx:102-103, 247-261`). Diferenças de régua:

- Agrupa por **(closer, deal)** e não (SDR, deal); recorte de BU é `closers.bu`, não o squad do agendador — portanto **não aplica o filtro de SDR elegível**.
- Janela = mês inteiro, sem corte em hoje; exclui só `slot.status` cancelled/canceled; aceita `rescheduled` no universo. Realizada = `completed | contract_paid | refunded` (mesma régua do card).
- O Total A/B soma apenas os dois segmentos; negócio sem `icp_segment` não aparece.

```text
69  card (A 58 + B 6 + sem segmento 5)
- 5  negócios sem icp_segment (não existem nas colunas A/B)
+ 7  negócios de agendadores excluídos pelo filtro de SDR do card
     (nicola.ricci, rodrigo.martinho, jessica.bellini, todos com segmento)
----
71  Total A(64) + B(7) da tabela de Closers
```

Medição independente pelo lado do closer confirmou exatamente A = 64, B = 7, 71 pares (closer, deal), sem nenhum negócio de segmento nulo.

## Leitura do diagnóstico

As três contagens não são "uma certa e duas erradas": são três recortes diferentes.
- Card: BU pelo **squad do agendador**, sem origem, realizada inclui pago/reembolsado, corta em hoje, restrito à lista oficial de SDRs.
- Function: BU pela **origem do negócio**, realizada só `completed`, mês inteiro, sem recorte de agendador.
- Tabela de Closers: BU pelo **closer**, mês inteiro, sem recorte de agendador, e o Total A/B perde o que não tem segmento.

Nenhuma correção proposta neste momento, conforme pedido.
