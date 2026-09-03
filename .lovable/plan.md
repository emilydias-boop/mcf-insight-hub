# Medição Lead A — Agenda BU-Incorporador, setembro/2026 (somente leitura)

Universo: `meeting_slots` + `meeting_slot_attendees`, `closers.bu='incorporador'`, `ms.meeting_type='r1'`, `msa.is_partner=false`, `msa.deal_id not null`, slot e attendee fora de cancelled/canceled/cancelada, eixo `(ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date` em 01–30/09/2026, `UPPER(TRIM(crm_deals.icp_segment))='A'`.

| Variação | Setembro inteiro | Até 03/09 |
| --- | --- | --- |
| V1 attendees `completed` | 61 | 61 |
| V2 deals distintos `completed` | 61 | 61 |
| V3 slots distintos com ≥1 `completed` | 37 | 37 |
| V4 deals distintos em completed+contract_paid+refunded | 91 | 91 |
| V5 pares (closer, deal) mesmos status | 91 | 91 |
| V6 V4 restrito a SDR elegível | 88 | 88 |
| V6 V5 restrito a SDR elegível | 88 | 88 |

Mês inteiro = até 03/09: nenhuma reunião com `scheduled_at` após 03/09 está marcada como realizada/paga ainda, então o corte "até hoje" não muda nada.

Composição dos 91: `completed` 61 + `contract_paid` 30 + `refunded` 0. (Ainda em aberto no mesmo recorte: `invited` 59, `no_show` 37 linhas / 33 deals, `rescheduled` 4.)

V1=V2 e V4=V5: nenhum deal aparece duas vezes e nenhum deal tem dois closers no mês — a régua de pares não infla nada aqui.

V6: 3 deals ficam fora por `booked_by` que não está em `get_sdrs_for_squad_in_period('incorporador', …)`. Nenhum SDR do período foi excluído pelas roles administrativas (o filtro de roles não removeu ninguém neste mês).

Nenhuma variação reproduz A=64 (tabela de Closers) nem A=58 (card). Com a régua da agenda + `closers.bu` o número é 91 (88 com recorte de SDR); a diferença de ~27–30 vem de outro filtro que essas telas aplicam e que não está neste recorte — provavelmente janela/eixo de data ou filtro de origem/produto do lado do card, não do universo da agenda.

## a) Origens

Só uma origem aparece nos 91 Lead A realizados:

| origin_id | origem | linhas | deals |
| --- | --- | --- | --- |
| e3c04f21-ba2c-4c66-84f8-b4341c826b1c | PIPELINE INSIDE SALES | 91 | 91 |

Zero fora das duas origens que a `ote-consorcio-metrics` usa; a segunda (PILOTO ANAMNESE / INDICAÇÃO, `7431cf4a…`) não aparece em setembro. Ou seja: com o recorte passando a ser agenda + `closers.bu='incorporador'`, o filtro por origem é redundante neste mês — não corta nada. Ele continua relevante como cinto de segurança para meses em que a origem PILOTO volte a produzir, mas não é o que define o número.

## b) `icp_segment` é mutável — sim, e isso afeta a reprodutibilidade

`crm_deals.icp_segment` é reescrito pelo trigger `trg_classify_lead_icp_segment` a cada INSERT/UPDATE em que `qualification_answers.renda` ou `finalidade_obra`/`objetivo` mudem (renda ≥ 10.000 → A, abaixo → B, finalidade "morar" → C, e C vence). O trigger só age nas origens `e3c04f21…` e `7431cf4a…`.

Não existe tabela de histórico de `icp_segment`: `audit_logs` não tem nenhuma linha para `crm_deals` e os triggers de log cobrem stage, owner, closer e tags — não o segmento. As outras tabelas com coluna `icp_segment` (`meeting_ai_reviews`, `closer_resumo_ia`, `sales_script_steps`, `vw_closer_reuniao_avaliada`) são snapshots de uso próprio, não histórico.

Consequência: o KPI calculado por `crm_deals.icp_segment` **não é reprodutível mês a mês**. Reprocessar setembro em outubro pode dar outro número se alguém reeditar a qualificação de um lead.

Existe, porém, um snapshot aproveitável: `meeting_slots.lead_type`, preenchido por `trg_meeting_slot_herda_segmento` no momento da criação do slot e nunca reescrito depois. É o candidato natural para congelar o KPI.

## c) Segmento que mudou depois do agendamento

Comparando `meeting_slots.lead_type` (segmento no agendamento) com `crm_deals.icp_segment` de hoje, nas linhas realizadas (completed/contract_paid/refunded):

| segmento hoje | snapshot no agendamento | linhas |
| --- | --- | --- |
| A | A | 91 |
| B | A | 11 |
| C | A | 1 |

Ou seja: 12 reuniões realizadas foram agendadas como Lead A e hoje não são mais A — elas saíram do KPI depois do fato. O caminho inverso (agendado como B/C e hoje A) não aparece nas linhas realizadas.

Ressalva: `lead_type` vive no slot, não no attendee, então em slot com vários attendees o snapshot é do slot. Para os 91 do V4 o snapshot bate 1:1.

## Nada foi alterado

Somente SELECT. Nenhuma escrita, migration ou deploy. Não registrei esta medição em `roadmap.md` porque em modo plano só edito o arquivo do plano — posso registrar assim que a implementação for aprovada.
