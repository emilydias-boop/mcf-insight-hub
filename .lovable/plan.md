## Objetivo

Garantir que o callback `mcf-pay-callback` processe normalmente (HTTP 200) mesmo quando o attendee/deal já está marcado como `contract_paid` manualmente — sem pular etapas e sem bloquear.

## Estado atual

A função já atualiza `meeting_slot_attendees.contract_paid_at`/`status` e `crm_deals.custom_fields` independentemente do status anterior, mas há dois pontos que podem confundir/parar o fluxo quando o lead já foi pago manualmente:

1. Em `resolveDeal`, quando há múltiplos deals do mesmo contato, o desempate prefere o attendee **sem** `contract_paid_at`. Se o único deal existente já estiver pago manualmente, ele ainda é escolhido (cai no `deals[0]`), mas em cenários com vários deals do mesmo cliente o pago manualmente pode ser ignorado.
2. O log de sucesso não distingue se já estava pago — dificulta auditoria de "pago manualmente vs pago via MCF Pay".

## Mudanças em `supabase/functions/mcf-pay-callback/index.ts`

1. **Desempate inverso**: quando o payload traz `transaction_id`, priorizar deal cujo attendee já está `contract_paid` (provável vínculo manual aguardando confirmação do pagamento). Caso contrário, manter a preferência pelo unpaid.
2. **Sempre aplicar updates** (já faz) e gravar `mcf_pay_transaction_id` em `custom_fields` mesmo se já pago — ancora o vínculo para próximos eventos.
3. **Preservar `contract_paid_at` mais antigo**: se o attendee já tem `contract_paid_at`, manter o existente (fonte de verdade da venda manual) e apenas registrar `mcf_pay_paid_at` em `custom_fields`. Não sobrescrever para frente nem para trás.
4. **Telemetria**: incluir no log de sucesso `already_paid: true|false` e `kept_existing_contract_paid_at: true|false` para auditoria.
5. **Resposta 200** sempre que a assinatura for válida e o deal resolvido, mesmo idempotente.

## Verificação

- Reenviar o webhook do André (já pago manualmente): esperar HTTP 200, `match_strategy = customer_email`, `already_paid = true`, `kept_existing_contract_paid_at = true`, e `custom_fields.mcf_pay_transaction_id = pay_348fwsh5ngpkxypn`.
- Conferir que `contract_paid_at` do attendee não foi alterado.
- Conferir aba "Recebidos" em `/admin/integracao-mcf-pay` mostrando o evento como sucesso.
