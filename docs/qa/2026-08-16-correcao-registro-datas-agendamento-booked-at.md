# Correção do registro de datas de agendamento (booked_at) — aplicado

Data: 2026-08-16

## Contexto

`meeting_slot_attendees.booked_at` é a marca de **quando o agendamento foi feito**; `meeting_slots.scheduled_at` é **quando a reunião acontece**. As duas RPCs de métrica já distinguem os eixos:

- `agendamentos` = `COALESCE(msa.booked_at, msa.created_at)` — agendamentos feitos no período
- `r1_agendada` = `(ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date` — reuniões marcadas para o período

O problema: `booked_at` não tinha DEFAULT e o fluxo principal de criação gravava NULL por decisão explícita quando a reunião era futura (`calendly-create-event/index.ts`):

```
let bookedAtValue: string | null = null;
if (body.bookedAt) bookedAtValue = body.bookedAt;
else if (scheduledDate < now) bookedAtValue = scheduledAt;
// reunião futura -> NULL
```

As telas não quebravam porque as RPCs fazem `COALESCE` em runtime — mas o dado não era auditável na linha.

## Medição (R1, mar–ago/2026) — % de `booked_at` nulo

| mês | Consórcio | Incorporador |
|---|---|---|
| 2026-03 | 0,6% | 0,1% |
| 2026-04 | 93,9% | 99,1% |
| 2026-05 | 92,1% | 98,7% |
| 2026-06 | 93,6% | 99,0% |
| 2026-07 | 92,5% | 99,5% |
| 2026-08 | 90,7% | 98,6% |

Março não é exceção de fluxo: é backfill único (1.529 linhas, 1.520 com `booked_at <> scheduled_at`). **O Incorporador não estava correto — estava pior que o Consórcio.**

`booked_by` está preenchido em 99,9% das linhas. Distribuição no Consórcio: SDR 1.676, closer 15, admin 3, sem role 2.

## Alterações de banco

Migration `20260816135624_d8a6d0e2-9839-4f2d-8882-fc853735f44e.sql`:

1. `ALTER TABLE public.meeting_slot_attendees ALTER COLUMN booked_at SET DEFAULT now();`
2. `UPDATE public.meeting_slot_attendees SET booked_at = created_at WHERE booked_at IS NULL;` — **7.625 linhas**, nulos a zero. Não altera nenhum número de tela (é o que as RPCs já faziam em runtime); o ganho é auditabilidade na linha.
3. `CREATE FUNCTION public.log_slot_time_change()` + `CREATE TRIGGER trg_log_slot_time_change AFTER UPDATE OF scheduled_at ON public.meeting_slots` — grava uma linha por attendee em `attendee_movement_logs` com `movement_type = 'slot_time_changed'`, guardando `from_scheduled_at`/`to_scheduled_at`, closers e ator. Corpo envolvido em `EXCEPTION WHEN OTHERS THEN NULL` para nunca derrubar o UPDATE do slot.

Migration `20260816141111_c4e2ce52-f3e8-4d34-80b1-5267e61e2f2a.sql`: correção do trigger — `from_closer_name` passa a vir de `OLD.closer_id` e `to_closer_name` de `NEW.closer_id` (antes ambos vinham do NEW, gerando log errado quando `scheduled_at` e `closer_id` mudavam juntos).

## Alterações de código

Caminhos que não gravavam `booked_at` e passaram a gravar:

| Caminho | Arquivo |
|---|---|
| Agendamento principal R1/R2 | `supabase/functions/calendly-create-event/index.ts` |
| Adicionar participante/sócio ao slot | `src/hooks/useAgendaData.ts` (`useAddMeetingAttendee`) |
| Agendamento manual de R2 (2 pontos) | `src/hooks/useR2AgendaData.ts` |
| Lead manual aprovado | `supabase/functions/create-manual-approved-lead/index.ts` |

O último roda como `service_role`, então o `DEFAULT auth.uid()` de `booked_by` não resolvia — passou a receber o usuário explicitamente.

Painel Comercial do Consórcio (`src/pages/bu-consorcio/PainelEquipe.tsx`): duas visões colapsavam `Agendamento` e `R1 Agendada` no mesmo número.

- `closerKPIs` fazia literalmente `totalR1Agendada = totalAgendamentos`. Agora `agendamentos` tem cálculo próprio em `useR1CloserMetrics`, com query independente por `booked_at` (sem filtro de `scheduled_at`, para capturar agendamento feito no período para reunião fora dele), aplicando as mesmas exclusões do hook (slot não cancelado, `is_partner = false`, offset BRT) e o mesmo dedup por `deal_id` com cap 2 por dias distintos.
- `pipelineFilteredBySDR` incrementava `agendamentos` por reunião do recorte, virando contagem por `scheduled_at`. Corrigido para usar `booked_at`.

## Validação antes/depois

| métrica | antes | depois |
|---|---|---|
| `booked_at IS NULL` (tabela inteira) | 7.625 | 0 |
| R1 Agendada — visão por pipeline, Consórcio, jul/2026 | 0 | 336 |
| Agendamentos — aba Closers, Consórcio, jul/2026 (efeito do dedup) | 291 | 286 |

Sobre a linha do meio: o critério antigo era `if (status.includes('agendada'))`, mas o `status_atual` dessa fonte traz o status cru do attendee (jul/2026: `completed` 249, `no_show` 61, `invited` 18, `contract_paid` 6, `rescheduled` 2) — nunca contém "agendada". **A linha estava zerada, não subestimada.** O critério novo é incondicional, alinhado às RPCs: uma reunião realizada também foi agendada. Comentário datado deixado no código.

## Achado: reescrita retroativa de `scheduled_at`

`useUpdateMeetingSchedule` (drag-and-drop da agenda) faz `update meeting_slots set scheduled_at` no slot compartilhado, sem log e sem criar registro novo. Isso reescreve retroativamente a data da reunião de **todos** os attendees daquele slot — qualquer série histórica por `scheduled_at` muda para trás.

O caminho de remarcação de no-show (`MoveAttendeeModal`) faz certo: cria attendee novo com `parent_attendee_id` e grava `attendee_movement_logs`. O drag-and-drop não usa esse caminho.

**Decisão:** o comportamento do drag-and-drop foi mantido — convertê-lo mudaria o que a equipe vê ao arrastar um card. O trigger resolve a auditabilidade sem mudar comportamento. A conversão completa fica como decisão separada.

## Não alterado (deliberado)

- `get_sdr_metrics_from_agenda` e `get_sdr_metrics_from_agenda_consorcio` — divergem entre BUs em dedup, cap de no-show, segmento ICP e definição de contrato. Alterar reescreveria números de meses fechados.
- `useUpdateMeetingSchedule` — ver acima.
- Nenhuma regra de negócio, filtro ou permissão.

## Irrecuperável

- Hora real do ato de agendar de abr–ago/2026: resta `created_at` (boa proxy — a linha nasce no clique), não campo de negócio. Março tem `booked_at` sintético de backfill anterior.
- Data original das reuniões remarcadas por drag-and-drop antes de 16/08/2026: sobrescrita sem log.
- `booked_by` das linhas criadas por `service_role` antes desta correção.

## Pendências

1. **Ordenação da tabela de SDRs.** No caminho sem filtro de pipeline vale o sort antigo de `bySDR` em `useTeamMeetingsData.ts` (`agendamentos` desc, ex-squad no fim). Cosmético — muda ordem de linha, não números.
2. **Dedup novo só vale para a aba Closers.** A aba SDRs se alimenta das RPCs, intocadas.
3. **Attendee sem `deal_id`:** descartado em `r1_agendada`, conta 1 em `agendamentos`. Documentado em comentário.
4. **`bu_origin_mapping` errado para Consórcio:** grupo default é `BU - LEILÃO`; `Viver de Aluguel` (`4e2b810a-…`) não está mapeada (vive no grupo `Perpétuo - X1`, do Incorporador); existe a origem `Cobrança Consorcio` (`ea7aac02-…`) desconhecida pelas constantes de `useConsorcioPostMeeting.ts`. Afeta `useBUFunnelComplete` / Visão Geral do CRM. **Requer auditoria própria.**
5. **221 deals (16,9%)** em R1 Realizada com origem de Consórcio **sem nenhum attendee em slot não cancelado** — somem de qualquer corte por `scheduled_at`.
6. **96 reuniões (5,7%)** já passadas sem desfecho: 78 `invited` + 18 `rescheduled`. Não são realizadas nem no-show; puxam a taxa de conversão para baixo. **Acionável pela operação.**

## Como verificar

```
select column_default from information_schema.columns
where table_name = 'meeting_slot_attendees' and column_name = 'booked_at';
-- esperado: now()

select count(*) from meeting_slot_attendees where booked_at is null;
-- esperado: 0

select tgname from pg_trigger where tgrelid = 'public.meeting_slots'::regclass;
-- esperado: incluir trg_log_slot_time_change

select * from attendee_movement_logs
where movement_type = 'slot_time_changed' order by created_at desc limit 20;
```

Na tela: Painel Comercial do Consórcio → matriz de metas. `Agendamento` e `R1 Agendada` devem mostrar números **diferentes** na aba Closers, na aba SDRs e com filtro de pipeline. Iguais em alguma visão = regressão.

## Commits e arquivos

| commit | conteúdo |
|---|---|
| `7a8f805c` | edge functions e hooks gravam `booked_at`; migration `20260816135624`; primeiros ajustes do Painel |
| `2a1cecf3` | `agendamentos` próprio na aba Closers; correção do critério de R1 Agendada; migration `20260816141111` |
| `e9b60ef6` | dedup unificado, remoção da flag `agendamentosUnavailable`, ordenação |

Arquivos: `calendly-create-event/index.ts`, `create-manual-approved-lead/index.ts`, `useAgendaData.ts`, `useR2AgendaData.ts`, `useR1CloserMetrics.ts`, `useTeamMeetingsData.ts`, `TeamKPICards.tsx`, `ConsorcioSdrSummaryTable.tsx`, `PainelEquipe.tsx` + 2 migrations.

Publicado em produção em 16/08/2026.
