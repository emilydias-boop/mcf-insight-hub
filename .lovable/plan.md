
# Automação "Reunião Agendada" — BU Incorporador (piloto R1)

Decisões confirmadas:
- **Tom**: profissional, sem emojis.
- **Escopo**: só R1 (PIPELINE INSIDE SALES → R1 Agendada, e PILOTO ANAMNESE/INDICAÇÃO → Reunião 01 Agendada). R2 fica para a rodada 2.
- **Lembretes**: só `d-1` e `m-20`. D-1 dispara **24h antes exatas** do horário da reunião (não em horário fixo).
- **Posicionamento da mensagem**: reunião com o **especialista da MCF Capital** (e não "MCF Incorporador").

## Cobertura

### Caminho B — Confirmação no agendamento (2 fluxos)

| Origem | Estágio gatilho | stage_id |
|---|---|---|
| PIPELINE INSIDE SALES | R1 Agendada | `e9ed8f0e-a272-4eba-acc7-434191569282` |
| PILOTO ANAMNESE / INDICAÇÃO | Reunião 01 Agendada | `a8365215-fd31-4bdc-bbe7-77100fa39e53` |

Config por fluxo: `trigger_on=enter`, `respect_business_hours=false`, `exclude_weekends=false`, 1 step `send_message` com delay 0, `conditions={dedupe_key:'deal_id+stage_id'}`.

### Caminho A — Lembretes (BU Incorporador)

`meeting_reminder_settings` já tem a coluna `applies_to_bus text[]` (default NULL = todas). No piloto: `applies_to_bus=['incorporador']`, `enabled_offsets=['d-1','m-20']`. O cron de 5min calcula `scheduled_at - offset`, então o D-1 sai 24h antes do horário exato da R1.

## Templates Twilio (3, tom profissional)

**1. Confirmação Reunião Agendada — MCF Capital** (Caminho B)
Variáveis: `{1}=nome_lead`, `{2}=data_hora`, `{3}=nome_closer`, `{4}=link_reuniao`

> Olá, {1}. Sua reunião com o especialista da MCF Capital está confirmada.
> Data e horário: {2}
> Especialista: {3}
> Link: {4}
>
> Caso precise remarcar, responda esta mensagem.
> — MCF Capital

**2. Lembrete D-1 — MCF Capital** (offset `d-1`)
Variáveis: `{1}=nome_lead`, `{2}=data_hora`, `{3}=nome_closer`, `{4}=link_reuniao`

> Olá, {1}. Lembrando da sua reunião amanhã com o especialista da MCF Capital.
> Data e horário: {2}
> Especialista: {3}
> Link: {4}
>
> Confirma sua presença? Em caso de imprevisto, responda esta mensagem.
> — MCF Capital

**3. Lembrete M-20 — MCF Capital** (offset `m-20`)
Variáveis: `{1}=nome_lead`, `{2}=link_reuniao`

> Olá, {1}. Sua reunião com o especialista da MCF Capital começa em 20 minutos.
> Link de acesso: {2}
>
> Recomendamos entrar com alguns minutos de antecedência.
> — MCF Capital

Categoria Twilio: **utility**. Sem quick reply buttons nesta rodada.

## Ordem de execução

```text
1. Migration: garantir coluna applies_to_bus em meeting_reminder_settings (se faltar)
2. INSERT dos 3 registros em automation_templates (approval_status='pending')
3. Submeter os 3 templates ao Twilio Content Builder (manual, fora do código)
4. Aguardar aprovação Twilio
5. UPDATE twilio_template_sid + approval_status='approved' nos 3 registros
6. INSERT 2 linhas em automation_flows + 2 em automation_steps (Caminho B)
7. UPDATE meeting_reminder_settings: applies_to_bus=['incorporador'],
   enabled_offsets=['d-1','m-20'], is_active=true
8. Patchar meeting-reminders-cron com filtro applies_to_bus (se ainda não respeitar)
9. Smoke test: 1 envio manual por template para nº pessoal antes de ligar
10. Monitorar /admin/automacoes por 48h
```

## Riscos

- **Falhas Twilio** (102 em 17-18/05): logging detalhado já em `automation-processor`. Validação manual no passo 9.
- **Reagendamento dispara confirmação duplicada**: bloqueado por `dedupe_key=deal_id+stage_id` + `automation_blacklist`.
- **R2 fora do piloto**: avanço para Reunião 02 Agendada não dispara nada nesta rodada — intencional.

## Detalhes técnicos

- Tabelas: `automation_flows`, `automation_steps`, `automation_templates`, `meeting_reminder_settings`, `automation_queue`, `automation_logs`, `automation_blacklist`.
- Edge functions: `automation-processor`, `meeting-reminders-cron` (filtro BU), `twilio-whatsapp-send`.
- Migrations: no máximo 1 (coluna `applies_to_bus`, se ainda não existir). Restante via INSERT/UPDATE.
- Sem mudança de frontend.
