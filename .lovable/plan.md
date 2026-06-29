# Webhook reverso MCF Pay → CRM

## Decisões confirmadas

- Segredo HMAC separado: `MCF_PAY_CALLBACK_SECRET` (já gerado).
- Identificador: apenas `deal_id` (UUID).
- Em caso de duplicata com Hubla: **MCF Pay prevalece** — sobrescreve `contract_paid_at` com a data do MCF Pay e marca a fonte como `mcf_pay`.
- Faturamento MCF Pay aparece em Daily View, Meu Desempenho e Contratos. Painel Comercial fica de fora por enquanto.

## Payload que o MCF Pay deve enviar

```text
POST https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/mcf-pay-callback
Content-Type: application/json
x-mcf-pay-signature: <HMAC-SHA256(body, MCF_PAY_CALLBACK_SECRET) em hex>

{
  "event": "payment.confirmed",
  "timestamp": "2026-06-29T14:30:00Z",
  "data": {
    "deal_id": "bef4ff52-...",         // obrigatório (UUID do crm_deals)
    "status": "paid",                  // "paid" | "refunded"
    "paid_at": "2026-06-29T14:25:00Z", // ISO-8601 UTC
    "amount": 17490.00,                // BRL
    "transaction_id": "txn_mcfpay_abc123" // opcional, para auditoria
  }
}
```

Resposta:
- `200 OK` + `{ "ok": true }` → MCF Pay considera entregue.
- 4xx (ex.: assinatura inválida, deal não existe) → não tentar de novo.
- 5xx ou timeout → MCF Pay reenvia em 5min, 30min e 2h.

Para `status: "refunded"`, o CRM zera `contract_paid_at` do attendee correspondente e registra no log.

## O que o CRM faz ao receber

1. Validar `x-mcf-pay-signature` contra `MCF_PAY_CALLBACK_SECRET`.
2. Buscar o `meeting_slot_attendees` ligado ao `deal_id` (ou o próprio `crm_deals` se não houver attendee).
3. Atualizar:
   - `meeting_slot_attendees.contract_paid_at` = `paid_at` (sobrescreve Hubla se existir).
   - `meeting_slot_attendees.status` = `contract_paid`.
   - Marcar fonte `mcf_pay` em `custom_fields.payment_source` do deal.
4. Gravar log em `mcf_pay_dispatch_logs` com `direction = 'inbound'`.
5. Responder 200.

## Infraestrutura

1. Nova edge function `mcf-pay-callback` (verify_jwt = false, valida HMAC em código).
2. Coluna nova `mcf_pay_dispatch_logs.direction` (`outbound` | `inbound`).
3. Tela `/admin/integracao-mcf-pay` ganha aba "Recebidos" mostrando os callbacks inbound com payload, status HTTP e deal vinculado.
4. Secret `MCF_PAY_CALLBACK_SECRET` (já criado) precisa ser cadastrado também no MCF Pay para gerar a assinatura.

## Após implementar

Envio a URL `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/mcf-pay-callback` e o valor do segredo (consultável em Workspace Settings → Secrets) para você cadastrar no MCF Pay.