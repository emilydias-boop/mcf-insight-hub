# Diagnóstico: reuniões "Realizadas" da Agenda que não chegam ao Pós-Reunião

## Resumo

Não é regra de negócio nem problema de nome de stage por origem. É um **caminho de código que atualiza o participante sem sincronizar o CRM**.

Existem duas telas que marcam "Realizada":

| Tela | Hook usado | Sincroniza stage? |
|---|---|---|
| Agenda R1 (`AgendaMeetingDrawer`) | `useUpdateAttendeeAndSlotStatus` | Sim — chama `syncDealStageFromAgenda` |
| Painel do SDR (`SdrMeetingActionsDrawer`, botão "Realizada") | `useUpdateAttendeeStatus` | **Não** — só faz `update({ status })` no `meeting_slot_attendees` |

`src/hooks/useAgendaData.ts:2007` (`useUpdateAttendeeStatus`) grava o status e pronto. `syncDealStageFromAgenda` só é chamada em `useUpdateAttendeeAndSlotStatus` (linha 2277). Quem marca Realizada pelo Painel do SDR / "Minhas Reuniões" (`src/components/sdr/SdrMeetingActionsDrawer.tsx:191`) deixa o deal parado no stage em que estava.

## Por que o stage atual "NOVO LEAD ( FORM )" aparece tanto

Não é a função recusando mover a partir desse stage — ela **não olha o stage atual** (só faz skip se já estiver no stage de destino). O grupo grande em "NOVO LEAD ( FORM )" é simplesmente onde os leads de Efeito Alavanca ficam quando alguém agenda a reunião direto do formulário sem passar por "R1 Agendada"; como a sincronização nunca roda nesse caminho, eles ficam ali.

Evidência no banco (30 dias, `status='completed'` e stage sem "realizada"):
- 22 em NOVO LEAD ( FORM ) — nenhum tem atividade `deal_activities` com `metadata.via = 'agenda_sync'` (`sync_logs = 0`), isto é, a função nunca rodou para eles.
- Os poucos casos com `sync_logs > 0` são deals que foram sincronizados e depois voltaram de stage manualmente/por re-entrada — categoria diferente, menos urgente.

## Resposta às perguntas

1. **Por que falha em "NOVO LEAD ( FORM )"?** Não falha por causa do stage. A função nunca é chamada nesse fluxo (hook sem sync). Não há guarda de stage de origem, nem erro de nome de stage.
2. **É só Efeito Alavanca + Clube?** Não. Ocorre também em VDA (1 caso em NOVO LEAD) e em PIPELINE INSIDE SALES (9 casos). As duas origens de Consórcio têm stage de destino válido (`R1 Realizada` na EA, `REUNIÃO 1 REALIZADA` na VDA), então o lookup por nome funciona nas duas.
3. **Caminho mais seguro de correção?** Não existe motivo de negócio para exigir passagem por "R1 Agendada" — reunião marcada como Realizada é o próprio evento que qualifica o Pós-Reunião. O correto é:
   - Fazer o Painel do SDR usar o mesmo hook com sync (`useUpdateAttendeeAndSlotStatus`) em vez de `useUpdateAttendeeStatus`.
   - Adicionar em `syncDealStageFromAgenda` a guarda anti-regressão por `stage_order` (nunca puxar para trás um deal já em stage mais avançado, ex.: Contrato Pago / Venda Realizada).
   - Backfill pontual dos ~29 casos dos últimos 30 dias (mover para o "Realizada" da própria origem, respeitando a anti-regressão).

## Detalhes técnicos

- `syncDealStageFromAgenda`: `src/hooks/useAgendaData.ts:2034`. Mapeia status → lista de nomes de stage, busca `crm_stages` por `origin_id` + `ilike stage_name`, faz skip se já está no destino, transfere owner em `completed`/`contract_paid` e loga `deal_activities` com `metadata.via='agenda_sync'`.
- Falhas silenciosas secundárias a considerar no fix: o `update` em `crm_deals` pode retornar 0 linhas sem erro se a RLS de UPDATE (`manager|admin|sdr|closer`) não cobrir a role do usuário (ex.: `coordenador`, `gr`) — vale verificar sucesso e avisar em vez de seguir em silêncio.
