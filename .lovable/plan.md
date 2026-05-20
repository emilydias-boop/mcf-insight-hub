# Automação "Reunião Agendada" — BU Incorporador (piloto)

Escopo: **só BU Incorporador**, cobrindo as 2 origens mapeadas. Implementação combinada A+B em uma rodada controlada.

## Cobertura

**Caminho B (confirmação no agendamento) — 3 fluxos:**


| Origem                      | Estágio gatilho     | stage_id                               |
| --------------------------- | ------------------- | -------------------------------------- |
| PIPELINE INSIDE SALES       | R1 Agendada         | `e9ed8f0e-a272-4eba-acc7-434191569282` |
| PILOTO ANAMNESE / INDICAÇÃO | Reunião 01 Agendada | `a8365215-fd31-4bdc-bbe7-77100fa39e53` |
| PILOTO ANAMNESE / INDICAÇÃO | Reunião 02 Agendada | `af1734ad-9ed8-46b0-9389-3ad8d1973931` |


Cada fluxo: `trigger_on = enter`, `respect_business_hours = false`, `exclude_weekends = false`, 1 step `send_message` com delay 0.

**Caminho A (lembretes) — ativação restrita à BU Incorporador:**

`meeting_reminder_settings` é global hoje. Para limitar à BU Incorporador sem afetar nada, vou adicionar uma coluna `applies_to_bus text[]` (default `NULL` = todas, comportamento atual) e filtrar no `meeting-reminders-cron` por `agenda_r1.bu`/`agenda_r2.bu IN applies_to_bus`. Setamos `applies_to_bus = ARRAY['incorporador']` no piloto.

## Templates Twilio (precisam aprovação)

3 templates novos em `automation_templates` (`approval_status='pending'` até aprovação Twilio):

1. `**Confirmação Reunião Agendada — Incorporador**` (Caminho B)
  - Variáveis: `{1}=nome_lead`, `{2}=data_hora`, `{3}=nome_closer`, `{4}=link_reuniao`
2. `**Lembrete D-1 — Incorporador**` (Caminho A, offset `d-1` às 19h)
  - Variáveis: `{1}=nome_lead`, `{2}=data_hora`, `{3}=nome_closer`, `{4}=link_reuniao`
3. `**Lembrete M-20 — Incorporador**` (Caminho A, offset `m-20`)
  - Variáveis: `{1}=nome_lead`, `{2}=link_reuniao`

Offsets ativos no piloto: **só `d-1` e `m-20**` (em vez dos 6 atuais), até validar engajamento.

## Ordem de execução

```text
1. Migration: adicionar coluna applies_to_bus em meeting_reminder_settings
2. Inserir os 3 registros em automation_templates (status pending)
3. Submeter os 3 templates ao Twilio Content Builder para aprovação
4. (esperar aprovação Twilio — fora do código)
5. Atualizar twilio_template_sid + approval_status='approved' nos 3 registros
6. Inserir 3 linhas em automation_flows + 3 linhas em automation_steps
7. Atualizar meeting_reminder_settings: applies_to_bus=['incorporador'],
   enabled_offsets=['d-1','m-20'], is_active=true
8. Patchar meeting-reminders-cron para respeitar applies_to_bus
9. Monitorar /admin/automacoes por 48h: enviados, falhados, código Twilio
```

## Riscos e mitigações

- **Falhas atuais do Twilio** (102 em 17-18/05): logging detalhado já foi adicionado em `automation-processor`. Antes de ligar (passo 7), validamos com 1 envio manual ao nº pessoal do usuário usando cada template aprovado.
- **Dedupe**: `automation_blacklist` previne reenvio. Confirmar que está populada antes do passo 6.
- **Reagendamento**: Caminho A (lembretes) reage automaticamente; Caminho B não — se SDR mover o card pra trás e pra frente, dispara confirmação duplicada. Acrescentamos `conditions = {dedupe_key: 'deal_id+stage_id'}` no step para bloquear isso.

## Detalhes técnicos (não precisa ler)

- Tabelas: `automation_flows`, `automation_steps`, `automation_templates`, `meeting_reminder_settings` (+ coluna nova), `automation_queue`, `automation_logs`, `automation_blacklist`.
- Edge functions: `automation-processor` (já patchado para logging), `meeting-reminders-cron` (precisa filtro de BU), `twilio-whatsapp-send` (sem mudança).
- Migrations: só 1 (adicionar coluna). Resto é INSERT/UPDATE via ferramenta de dados.
- Sem mudança de frontend nesta rodada.

## Decisões suas antes de eu codar

1. **Texto dos 3 templates** — quer que eu rascunhe propostas (3 versões para você escolher) 
2. **Apenas R1 ou também R2** na BU Incorporador? Sugestão: só R1 e Reunião 01 no piloto, deixar R2 para depois da validação.
3. **Horário do lembrete D-1**: de acordo com a agenda da r1