## Diagnóstico

O template **"Confirmação Reunião Agendada — MCF Capital"** (SID `HXf11ce9f7418afceda35d113ae94ca22f`, aprovado) **não está vinculado a nenhum fluxo** em `automation_flows`. Quem dispara hoje é o fluxo **"Confirmação R1 Agendada — (Incorporador)"** (`a8d14cba…`), que ainda usa `content` em texto livre (`template_id` = NULL).

Nos últimos 7 dias, esse fluxo produziu:

| status | motivo | qtd |
|---|---|---|
| cancelled | `meeting_link_unresolved` | **157** |
| sent | — | 97 |
| cancelled | outros (owner desligado, remarcada) | 2 |

Ou seja, ~62% dos agendamentos são silenciosamente cancelados. A regra em `automation-processor` (linhas 301–350) exige que exista uma linha em `closer_meeting_links` com `closer_id + day_of_week + start_time` **exatos** (BRT). Se o horário do slot não bate com o cadastro do closer, ou o link ainda não foi cadastrado, o processador cai para `meeting_slots.meeting_link` / `video_conference_link` — que estão vazios nos casos que falharam — e cancela.

Exemplos reais de hoje (deals cancelados):
- Julio, Qua 21:00 — cadastro do Julio só vai até 20:30 na quarta.
- Leticia, Qua 14:30 — não existe linha de 14:30 no cadastro dela.
- William, Qua 21:00 — cadastro dele termina 18:00.

## O que vou fazer

### 1. Migrar o fluxo para o template aprovado da Meta (destrava o >24h e alinha o texto)
- Setar `automation_flows.template_id = 6ce02063-d194-4338-b48c-11cc331aafdb` no fluxo "Confirmação R1 Agendada — (Incorporador)".
- Ajustar o `automation-processor` para, quando o fluxo tem `template_id`, enviar via Twilio Content API (`ContentSid` + `ContentVariables`) em vez do `body` livre — mesmo caminho que o "Boas-vindas R2" já usa.

### 2. Reduzir cancelamentos por link
Adicionar fallbacks antes de cancelar, na ordem:
1. `closer_meeting_links` casando por `closer_id + day_of_week + start_time` (atual).
2. **Novo:** `closer_meeting_links` do mesmo `closer_id + day_of_week` mais próximo no tempo (±30 min) — cobre desalinhamentos de grade tipo Julio 21:00 vs 20:30.
3. `meeting_slots.meeting_link` / `video_conference_link` (atual).
4. **Novo:** link default do closer (primeira linha ativa em `closer_meeting_links` para o closer) como último recurso, marcando `link_source=closer_default`.
5. Só cancelar se **nada** for encontrado. E, quando o template tiver variável `{{link}}`/botão dinâmico, permitir enviar sem link se a variável for opcional — o template atual "Confirmação Reunião Agendada — MCF Capital" precisa ser inspecionado para confirmar quais variáveis são obrigatórias.

### 3. Observabilidade
- Adicionar log `[AUTOMATION-PROCESSOR] link_fallback=<source>` para cada envio.
- Criar uma view leve `v_automation_confirmacao_r1_health` com contagem de `sent` / `cancelled` por motivo nos últimos 7 dias, para monitorar depois do fix.

### 4. Reprocessar backlog do dia (opcional, sob confirmação)
Recolocar em `pending` os itens cancelados hoje por `meeting_link_unresolved` cujo `meeting_slot.scheduled_at` ainda é futuro, para que o novo processador tente novamente.

## Perguntas para você

1. **Confirmação da causa:** ok se eu adotar os fallbacks 2 e 4 acima (horário aproximado ±30 min e link default do closer)? Ou você prefere que o processador **nunca** envie um link diferente do slot exato e a solução seja apenas cadastrar os horários faltantes em `closer_meeting_links` (Julio 21:00, Leticia 14:30, William 21:00 etc.)?
2. **Reprocessar backlog** dos 157 cancelados de hoje/ontem, ou deixar só para os próximos agendamentos?
3. **Variáveis do template aprovado:** posso ler o conteúdo do SID `HXf11ce9f7418afceda35d113ae94ca22f` via Twilio para mapear `{{1}}`, `{{2}}`… nas variáveis do processador (`nome`, `data_hora`, `closer`, `link`), certo?

## Detalhes técnicos

Arquivos afetados:
- `supabase/functions/automation-processor/index.ts` — fallback de link + envio por `ContentSid` quando `flow.template_id` existir.
- Migração: `UPDATE automation_flows SET template_id = '…' WHERE id = 'a8d14cba…'`.
- Nova view SQL: `v_automation_confirmacao_r1_health`.

Sem mudanças de UI. Nenhum outro fluxo é afetado (o Boas-vindas R2 já usa `ContentSid`).
