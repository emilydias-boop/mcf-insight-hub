## Diagnóstico

O MCF Pay enviou o webhook com sucesso (assinatura válida — fingerprint bate). O payload é:

```json
{
  "event": "payment.confirmed",
  "data": {
    "amount": 497,
    "status": "paid",
    "paid_at": "2026-06-30T15:49:23...",
    "customer_email": "andre.st@unochapeco.edu.br",
    "transaction_id": "pay_348fwsh5ngpkxypn"
  }
}
```

O CRM rejeitou com **HTTP 400 `missing_deal_id_or_event`** porque a função `mcf-pay-callback` exige `data.deal_id` no payload **antes** de tentar resolver o deal por outras estratégias. Como o MCF Pay não enviou `deal_id` (a invoice foi criada manualmente lá), nunca chega ao fallback por email/telefone/nome que já implementamos.

## Correção

Em `supabase/functions/mcf-pay-callback/index.ts`:

1. Remover a checagem antecipada `if (!dealId || !event)` que bloqueia tudo.
2. Manter apenas a validação de `event` (continua obrigatório).
3. Deixar `resolveDeal(data)` executar com qualquer combinação de campos disponíveis: `deal_id`, `transaction_id`, `customer_email`, `customer_phone`, `customer_name`. Se nada casar, ele já retorna `404 deal_not_found` com telemetria das estratégias tentadas.
4. Ajustar o log de `deal_not_found` para incluir corretamente os campos planos (`customer_email`, etc.) que já estão sendo enviados.

Redeploy da função e pedir ao usuário para reenviar o webhook pelo painel do MCF Pay. Esperado: HTTP 200, deal do André Stormoski (`andre.st@unochapeco.edu.br`) resolvido via `customer_email`, attendee marcado como `contract_paid` e `mcf_pay_transaction_id` gravado em `custom_fields` para os próximos eventos.

## Verificação

- Consultar `mcf_pay_dispatch_logs` (`direction = 'inbound'`) após o reenvio: deve aparecer `status = success`, `match_strategy = customer_email`, `resolved_deal_id` igual ao deal do André.
- Confirmar em `meeting_slot_attendees` que o attendee do deal foi marcado como `contract_paid` com `contract_paid_at = 2026-06-30T15:49:23...`.
