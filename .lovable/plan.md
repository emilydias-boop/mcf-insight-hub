## Backfill dos 3 contratos pagos de 21/05/2026

Vou corrigir os 3 leads que pagaram hoje mas ficaram presos pelo trigger de trava de mês: **Marcos Muniz**, **Salomão Nava** e **Antonio Wesley**.

### Passos

1. **Fix definitivo do trigger** (`enforce_meeting_status_lock`)
   - Permitir bypass quando `auth.uid() IS NULL` (service_role / webhooks Hubla)
   - Mantém bloqueio normal para SDR/Closer humanos editando mês travado
   - Isso evita o problema acontecer de novo nas próximas vendas de Maio

2. **Localizar os 3 leads** via `hubla_transactions` de hoje (21/05/26) que estão sem `linked_attendee_id`, fazendo match por email/telefone com `meeting_slot_attendees`.

3. **Backfill manual** dentro da mesma migration:
   - `meeting_slot_attendees.status = 'contract_paid'`
   - `meeting_slot_attendees.contract_paid_at = data do pagamento Hubla`
   - `hubla_transactions.linked_attendee_id = id do attendee`
   - `crm_deals.stage_id = stage "Contrato Pago"` no pipeline correspondente

4. **Validar** com `supabase--read_query`:
   - Os 3 attendees aparecem como `contract_paid` hoje
   - As 3 transações estão linkadas
   - Os 3 deals estão na coluna Contrato Pago

### Detalhe técnico

- Tudo em uma migration (mudança de função + UPDATEs idempotentes com WHERE específico por nome/email)
- Não mexe em Maio inteiro, só nos 3 registros identificados
- Trava de Maio continua ativa pros humanos
