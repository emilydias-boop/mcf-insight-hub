## Teste final do template "Confirmação R1 Agendada"

Slot já existe: deal `2bad3125…`, William Ferreira, 21/05/2026 09:00 BRT, em R1 Agendada.

### Passos
1. **Popular o `meeting_link` do slot** com placeholder:
   ```
   UPDATE meeting_slots
   SET meeting_link='https://meet.google.com/teste-mcf-001'
   WHERE deal_id='2bad3125…' AND scheduled_at='2026-05-21 12:00:00+00';
   ```
2. **Re-enfileirar** a confirmação via `automation-enqueue` (enter R1 Agendada).
3. **Disparar** `automation-processor`.
4. **Verificar** `automation_logs.content_sent` — deve ter:
   - `Data e horário: 21/05/2026 às 09:00`
   - `Especialista: William Ferreira`
   - `Link: https://meet.google.com/teste-mcf-001`

   E no WhatsApp do +55 21 96738-5623 chega a mensagem real do Twilio renderizada.

### Observação
Link é só placeholder — não funciona no Google Meet. É puramente pra ver o template populado.