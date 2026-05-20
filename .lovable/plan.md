## Objetivo

Ligar os 3 fluxos automatizados de WhatsApp para a BU Incorporador, agora que todos os templates estão aprovados pela Meta.

## O que vai acontecer

1. **Confirmação no agendamento da R1** — dispara assim que o lead entra no stage "Reunião 01 Agendada" no PIPELINE INSIDE SALES (Incorporador). Template `Confirmação Reunião Agendada — MCF Capital`.
2. **Lembrete D-1** — enviado 24h antes da R1.
3. **Lembrete M-20** — enviado 20 minutos antes da R1.

Os lembretes 2 e 3 são disparados pelo cron `meeting-reminders-cron` (já configurado: `applies_to_bus=['incorporador']`, offsets `d-1` e `m-20`, apenas R1).

## Mudanças no banco (data, sem schema)

Via insert tool (UPDATE):

- `automation_flows` id `a8d14cba-406b-4c11-8a6c-47e4e43444dd` → `is_active=true`
- `meeting_reminder_settings` id `1` → `is_active=true`

## Validação pós-ativação

1. Confirmar na aba **Fluxos** que "Confirmação R1 Agendada — (Incorporador)" aparece como Ativo.
2. Confirmar na aba **Lembretes Reunião** que o toggle "Sistema ativo" está ligado.
3. **Smoke test**: agendar 1 R1 de teste no Incorporador com um número pessoal — deve receber a confirmação em segundos.
4. Para os lembretes, agendar uma R1 para daqui ~25 min e validar disparo do M-20.
5. Acompanhar `automation_logs` e `meeting_reminders_log` nas primeiras horas para detectar erros do Twilio.

## Riscos / observações

- `meeting_reminder_settings.ac_setup_confirmed` precisa estar `true` (ou o toggle do UI fica bloqueado). Se estiver `false`, vou setar para `true` no mesmo UPDATE já que estamos usando WhatsApp e não a sequência AC original.
- Caso o Twilio retorne erro de janela 24h ou template/categoria, os logs vão indicar — sem impacto nos leads.
- Outras BUs (Consórcio etc.) ficam de fora até termos templates próprios aprovados.

## Detalhes técnicos

```sql
UPDATE automation_flows
SET is_active = true
WHERE id = 'a8d14cba-406b-4c11-8a6c-47e4e43444dd';

UPDATE meeting_reminder_settings
SET is_active = true,
    ac_setup_confirmed = true
WHERE id = 1;
```

Nenhuma migração de schema, nenhum código frontend, nenhuma edge function nova.
