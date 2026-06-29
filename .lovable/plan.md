# Webhook reverso MCF Pay → CRM

## Payload que o CRM espera receber

```text
POST /functions/v1/mcf-pay-callback
Content-Type: application/json
X-MCF-Pay-Signature: <HMAC-SHA256 do body com o segredo compartilhado>

{
  "event": "payment.confirmed",
  "timestamp": "2026-06-29T14:30:00Z",
  "data": {
    "deal_id": "<uuid do crm_deals>",
    "external_reference": "<código opcional do MCF Pay>",
    "status": "paid",
    "paid_at": "2026-06-29T14:25:00Z",
    "amount": 17490.00,
    "closer_code": "<mcf_pay_closer_code do profile>",
    "sdr_code": "<mcf_pay_sdr_code do profile>",
    "metadata": {
      "buyer_email": "cliente@email.com",
      "buyer_phone": "5511999999999",
      "offer_name": "A000 - Contrato",
      "transaction_id": "<id da transação no MCF Pay>"
    }
  }
}
```

Resposta de sucesso: `200 OK` + `{ "received": true }`.
Falha: retry do MCF Pay em 5 min, 30 min e 2h.

## O que o CRM vai fazer ao receber

1. Validar a assinatura HMAC-SHA256 (segredo separado do webhook de ida).
2. Buscar o `crm_deals` pelo `deal_id`.
3. Se não encontrar, tentar match por `buyer_email` + `buyer_phone` + `offer_name`.
4. Se o deal já estiver marcado como pago pela Hubla (contrato_paid_at preenchido), registrar como "conferência duplicada" e não contar 2x.
5. Se não estiver pago, atualizar o deal para etapa vencedora e preencher:
   - `contract_paid_at` = `paid_at`
   - `contract_value` = `amount`
   - `payment_source` = 'mcf_pay'
6. Gravar log auditável em `mcf_pay_dispatch_logs` (agora em sentido reverso) para rastreio.
7. Disponibilizar essa venda nos relatórios: Daily View, Painel Comercial e Meu Desempenho.

## Infraestrutura a implementar

1. Edge Function `mcf-pay-callback` (recebe e valida payload).
2. Segredo `MCF_PAY_CALLBACK_SECRET` (HMAC-SHA256).
3. Nova coluna `crm_deals.payment_source` ('hubla' | 'mcf_pay' | 'manual').
4. Trigger/Função para garantir que deals pagos pelo MCF Pay contem nos relatórios sem duplicar com Hubla.
5. Tela de log `/admin/integracao-mcf-pay` mostrando também recebimentos reversos.

## Decisões pendentes

1. O segredo do callback deve ser separado (`MCF_PAY_CALLBACK_SECRET`) ou reaproveitar o `MCF_PAY_WEBHOOK_SECRET` de ida?
2. O identificador de retorno deve ser apenas `deal_id`, ou incluir também `external_reference`?
3. O Painel Comercial deve incluir MCF Pay no faturamento bruto agora, ou apenas em Daily View/Meu Desempenho/Contratos por enquanto?
4. Quando Hubla já registrou a mesma venda, ignoramos silenciosamente ou registramos como "conferência duplicada" nos logs?