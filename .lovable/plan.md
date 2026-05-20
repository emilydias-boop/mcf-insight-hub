## Cenário do teste
Simular como se o lead `ANTONIO MATHEUS RODRIGUES MARTINS` (telefone `21967385623`, deal `2bad3125…`) tivesse:
1. Acabado de cair na stage **Novo Lead** com SDR Nicola Ricci → dispara **"Boas vindas"** (WhatsApp `HX4aec6fb…`).
2. Sido agendado para o **William Ferreira**, R1 dia **21/05 às 09:00 (BRT)** → dispara **"Confirmação R1 Agendada — (Incorporador)"** (WhatsApp `HXe342197…`).

⚠️ As mensagens vão sair de fato pelo Twilio para o número **+55 21 96738-5623**. Confirme antes que esse é o seu próprio número de teste.

## Estado atual confirmado
- Deal está em **"Reunião 01 Agendada"**, sem `meeting_slot`, sem itens em `automation_queue`.
- Owner = `nicola.ricci@minhacasafinanciada.com` (Nicola Ricci) ✓
- Origin = PIPELINE INSIDE SALES (`e3c04f21…`) ✓
- William Ferreira profile_id = `a3a75942-b550-4102-af6d-d5885b4ba370` ✓
- Stages: Novo Lead = `cf4a369c…`, R1 Agendada = `a8365215…`
- Flows ativos para ambas as stages ✓ (templates com SID Twilio configurados)

## Passos do teste

### Passo 1 — Reset do deal para "Novo Lead"
`UPDATE crm_deals SET stage_id='cf4a369c…', stage_moved_at=now(), last_worked_at=now() WHERE id='2bad3125…'`

Em seguida invocar **manualmente** `automation-enqueue` (`triggerType:'enter'`, `newStageId:cf4a369c…`) — porque o update via SQL não passa pelos hooks React.

→ Esperado: 1 item em `automation_queue` para flow `c4957cc5…` (Boas vindas), `scheduled_at ≈ now()`.

### Passo 2 — Disparar o processor manualmente
`POST /automation-processor` (não esperar o cron de 5min).

→ Esperado: `automation_logs.status='sent'` + Twilio SID, mensagem "Boas vindas" chega no WhatsApp.

### Passo 3 — Criar meeting_slot para 21/05 09:00 com William Ferreira (R1)
```
INSERT INTO meeting_slots (id, scheduled_at, status, closer_id, meeting_type, duration_minutes, deal_id, created_by)
VALUES (gen_random_uuid(), '2026-05-21 12:00:00+00', 'scheduled', 'a3a75942…', 'r1', 60, '2bad3125…', '7aa935e2…');

INSERT INTO meeting_slot_attendees (meeting_slot_id, deal_id, contact_id, status, invited_at)
VALUES (<slot_id>, '2bad3125…', '0f338c31…', 'invited', now());
```
(09:00 BRT = 12:00 UTC)

### Passo 4 — Mover deal para "R1 Agendada"
`UPDATE crm_deals SET stage_id='a8365215…', stage_moved_at=now() WHERE id='2bad3125…'`

Invocar `automation-enqueue` 2x:
- `exit` em `cf4a369c…` (cancela boas-vindas pendentes se sobrarem)
- `enter` em `a8365215…` → flow `a8d14cba…`

→ Esperado: 1 item em `automation_queue` para flow Confirmação R1, `scheduled_at ≈ now()`.

### Passo 5 — Processor de novo
`POST /automation-processor`.

→ Esperado: log `status='sent'`, mensagem "Confirmação Reunião Agendada — MCF Capital" chega no WhatsApp com as variáveis (nome do closer, data, hora, link).

### Passo 6 — Validar
Consultar `automation_queue` + `automation_logs` + ler resposta dos invokes. Reportar:
- IDs de cada queue/log
- Twilio SID das duas mensagens
- Eventuais variáveis vazias detectadas pelo template (template usa variables; se faltar dado, retorna erro 21656).

## Fora de escopo
- Não vou mexer nos templates Twilio nem nos flows.
- Não vou simular D-1/M-20 (esses dependem do cron e janela temporal — a reunião está a >24h).
- Não vou apagar o deal depois — você decide se quer manter ou remover.

## Pergunta antes de começar
Confirmação para enviar mensagens reais via Twilio para **+55 21 96738-5623**?