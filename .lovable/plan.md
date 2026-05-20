# Automação "Reunião Agendada" — Caminho A + B

Combinar **lembretes oficiais** (calendário R1/R2) com **mensagem de confirmação no momento do agendamento** (gatilho de estágio).

## Fase 0 — Pré-requisito: estabilizar Twilio WhatsApp

Hoje há **102 falhas** em `twilio-whatsapp-send` nos últimos 7 dias (concentradas 17–18/05, destinos +5583/+5584). Ativar mais fluxos sobre uma base quebrada vai multiplicar o problema.

- Abrir logs detalhados de `twilio-whatsapp-send`, identificar o motivo (template não aprovado, From inválido, número fora de geo permission, opt-out, etc.)
- Corrigir a causa raiz e validar com 1 envio manual de teste
- Só seguir para Fase 1 com 0 falhas em 24h

## Fase 1 — Caminho B: Confirmação no agendamento

Mensagem única enviada quando o lead **entra** no estágio "Reunião Agendada". Escopo restrito às BUs de maior volume:

- **Inside Sales Crédito** (`INSIDE SALES - CREDITO` → estágio `REUNIÃO AGENDADA`)
- **Consórcio** (`Cobrança Consorcio` → `R1 Agendada`; `Efeito Alavanca + Clube` → `R1 Agendada`)
- **Crédito HE / Construção / Condo / Imóvel Pronto** (4 pipelines, estágio `Reunião agendada`)

Para cada uma: criar 1 linha em `automation_flows` com `trigger_on = enter`, `respect_business_hours = false` (confirmação deve sair na hora), `exclude_weekends = false`.

**Template novo** (precisa aprovação Twilio): `Confirmação R1 Agendada` — variáveis: `{nome_lead}`, `{data_hora}`, `{nome_closer}`, `{link_reuniao}`. Hoje só existe o template `Boa Vindas` aprovado.

**Step único** em `automation_steps`: `step_kind = send_message`, `delay = 0`, `channel = whatsapp`, `template_id = <novo>`.

## Fase 2 — Caminho A: Lembretes oficiais

Ligar `meeting_reminder_settings.is_active = true` (linha id=1 já existe, offsets `d-1, h-4, h-2, h-1, m-20, m-0` configurados, `apply_to_r1 = true`, `apply_to_r2 = true`).

**Antes de ligar:**

- Criar/aprovar **6 templates Twilio** correspondentes aos offsets (ou reusar 2: um "D-1" e um "no dia") — definir com o usuário quantas mensagens distintas faz sentido para o lead receber
- Validar que `meeting-reminders-cron` (já rodando a cada 5min) consegue ler `agenda_r1` / `agenda_r2` corretamente
- Definir `fallback_meeting_link` caso o lead não tenha link da sala

Os lembretes reagem a reagendamento e cancelam sozinhos em No-Show — é o mecanismo recomendado para "está chegando".

## Fase 3 — Observabilidade

- Painel em `/admin/automacoes` deve mostrar: enviados, falhados, taxa de entrega por template nas últimas 24h
- Alerta automático se falhas > 5% em 1h (já existe `automation_logs`, falta o alerta)

## Detalhes técnicos

**Tabelas envolvidas:** `automation_flows`, `automation_steps`, `automation_templates`, `meeting_reminder_settings`, `automation_queue`, `automation_logs`.

**Edge functions tocadas:** `automation-processor` (Caminho B), `meeting-reminders-cron` (Caminho A), `twilio-whatsapp-send` (ambos — precisa fix).

**Deduplicação:** `automation_blacklist` + chave (lead_id, flow_id, step_id) previne reenvio se o card sair/voltar do estágio. Confirmar que está populada corretamente antes de ligar Fase 1.

**Ordem de implementação:**

```text
Fase 0 (fix Twilio) → Fase 1 (1 BU piloto: Inside Sales) → monitorar 48h
→ Fase 1 expansão (demais BUs) → Fase 2 (lembretes) → Fase 3 (alertas)
```

## Decisões necessárias do usuário antes de implementar

1. Quais BUs entram no piloto da Fase 1? (sugestão: só Inside Sales)
2. Quantos lembretes distintos na Fase 2? (sugestão: 2 — D-1 noite e M-20)
3. Texto/tom dos templates novos (precisa redigir antes de submeter ao Twilio)