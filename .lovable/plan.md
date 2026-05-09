## Cadência WhatsApp Anti-No-Show — Implementação em 5 Ondas

Estende o motor de automações existente sem tocar UI do CRM. Ordem desenhada pra **risco zero** nas primeiras ondas.

---

### 🟢 Onda 1 — Editor de Templates Twilio (zero envio)

**Objetivo:** permitir criar/submeter templates HSM pela Meta direto pelo CRM, em paralelo à construção do resto. Aprovação Meta leva 24–48h, então começa cedo.

- Edge function `twilio-content-manage` com ações `list` / `create` / `submit` / `status` chamando Twilio Content API (`/v1/Content` + `/ApprovalRequests/whatsapp`).
- Migration: `automation_templates` ganha `approval_status`, `approval_submitted_at`, `approval_rejected_reason`, `buttons_config` (jsonb).
- Estender `TemplateEditorDialog.tsx`: editor de variáveis, editor de botões (URL/Quick Reply), preview, botão "Salvar rascunho", botão "Submeter à Meta", badge de status.
- Cron leve `twilio-content-status-poll` (a cada 30 min) atualiza status `pending → approved/rejected`.

**Validação:** criar 1 template de teste no CRM → ver no Twilio Console → submeter → status atualiza no CRM.

---

### 🟢 Onda 2 — Schema (sem trigger ainda)

**Objetivo:** preparar banco mantendo retrocompatibilidade total via defaults.

- Migration em `automation_steps`:
  - `anchor` text default `'stage_change'` (`'stage_change' | 'meeting_start'`)
  - `offset_minutes` integer default `0`
  - `min_lead_time_minutes` integer default `0`
  - `respect_send_window` boolean default `true`
  - `step_kind` text default `'message'` (`'confirmation' | 'reminder' | 'started' | 'message'`)
- Nova tabela `automation_routing_rules` (`flow_id`, `button_key`, `target_type`, `fallback_target_type`, `fixed_value`).
- Chaves em `system_settings`: `automations.timezone`, `automations.window_start/end`, `automations.anti_flood_minutes`, `automations.leticia_whatsapp`, `automations.pilot_tag`.
- Índice único `(flow_id, deal_id, step_id, scheduled_at)` em `automation_queue` pra idempotência.

**Validação:** automações antigas continuam idênticas; `SELECT` confirma colunas com defaults.

---

### 🟡 Onda 3 — Lógica nas edge functions (sem disparar)

**Objetivo:** funções ganham capacidade nova, mas só rodam via curl manual até a Onda 4.

- `automation-enqueue`: aceita `event=meeting_scheduled | meeting_rescheduled | meeting_cancelled`. Para cada step:
  - `scheduled_at = meeting.scheduled_at + offset_minutes`
  - Pula se `(meeting.scheduled_at - now()) * 60 < min_lead_time_minutes`
  - Se `respect_send_window=true` e cair fora 08–21h, ajusta para próxima abertura
  - Anti-flood `anti_flood_minutes` para confirmações
- `automation-processor`: respeita `scheduled_at` (`WHERE scheduled_at <= now()`); pula `now > scheduled_at + 5min` (tolerância 2min para `step_kind='started'`); revalida `meeting_slots.status` antes de enviar `started`; resolve botões via `automation_routing_rules`.
- `twilio-whatsapp-send`: nenhuma alteração estrutural.
- UI: estender `StepEditorDialog`, `FlowEditorDialog` (aba "Roteamento de botões"), `AutomationSettings`.

**Validação:** `curl_edge_functions` invoca `automation-enqueue` com payload fake → itens entram em `automation_queue` com horários certos, **nada envia** porque flow está `is_active=false`.

---

### 🟡 Onda 4 — Trigger + flow piloto restrito

**Objetivo:** sistema vivo começa a reagir, mas só pra leads em whitelist.

- Trigger DB em `meeting_slots`:
  - `AFTER INSERT` → `pg_net.http_post` async para `automation-enqueue` (`event=meeting_scheduled`)
  - `AFTER UPDATE OF scheduled_at` → cancela `pending` da fila + `event=meeting_rescheduled`
  - `AFTER UPDATE OF status` (cancelled/no_show) → cancela `pending`
  - Função com `EXCEPTION WHEN OTHERS THEN RETURN NEW` (nunca bloqueia)
- Criar `flow_r1_agendada_PILOTO` com `is_active=true` mas filtro: só leads com tag `automation_pilot=true`.
- Cadastrar 2-3 templates já aprovados (vindos da Onda 1).
- Routing rules: R1 `agendar`/`falar_sdr` → `sdr_owner_whatsapp`; `entrar` → `meeting_url`.

**Validação:** R1 fictícia com lead da whitelist (seu WhatsApp) → confirmação + lembretes nos horários certos. R1 com lead **fora** da whitelist → nada enviado.

---

### 🟢 Onda 5 — Rollout gradual

**Objetivo:** abrir pra todos os leads com convivência segura ao cron antigo.

1. Confirmar 10 templates aprovados pela Meta.
2. Remover whitelist do flow R1 → ativa pra todos os leads R1.
3. Monitorar 48h em `automation_logs` (taxa de erro, duplicatas, opt-outs).
4. Ativar flow R2.
5. **Desligar `meeting-reminders-cron`** (evita duplicata).
6. Ativar F4 No-Show e F5 Pós-contrato (Letícia Rodrigues como destino).

---

### Cadência final por reunião agendada

| Gatilho | Quando | step_kind | offset | min_lead | janela |
|---|---|---|---|---|---|
| Confirmação | Imediato ao agendar/remarcar | `confirmation` | 0 | 0 | não |
| Lembrete −24h | Se faltam ≥ 24h | `reminder` | −1440 | 1440 | sim |
| Lembrete −3h | Se faltam ≥ 3h | `reminder` | −180 | 180 | sim |
| Lembrete −15min | Se faltam ≥ 15min | `reminder` | −15 | 15 | não |
| Reunião começou | T+0 | `started` | 0 | 0 | não |

### Roteamento dos botões

| Flow | Agendar | Falar SDR | Entrar |
|---|---|---|---|
| F1/F4 R1 | wa.me SDR dono | wa.me SDR dono | meeting_url |
| F2 R2 | meeting_url | wa.me SDR dono | meeting_url |
| F5 Pós-contrato | wa.me Letícia | wa.me SDR dono | — |

### Pré-requisitos confirmados

- ✅ Twilio (`TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM`) configurado
- ⏳ WhatsApp da Letícia Rodrigues — preencher em `system_settings.automations.leticia_whatsapp` na Onda 2
- ⏳ Whitelist tag em 5–10 leads de teste antes da Onda 4

### Princípios de segurança aplicados

- Defaults retrocompatíveis em todas as colunas novas
- Trigger sempre async + `EXCEPTION WHEN OTHERS THEN RETURN NEW`
- Flow novo nasce com `is_active=false` ou whitelist
- `meeting-reminders-cron` só desliga após validação do flow novo
- Rollback de cada onda em 1 comando (`DROP TRIGGER` / `is_active=false` / revert deploy)

### Começo

Implementar **Onda 1** completa nesta primeira leva (edge function `twilio-content-manage` + migration `automation_templates` + extensão `TemplateEditorDialog` + cron de status). Ondas 2–5 viram tarefas separadas após validação da Onda 1.
