## Redisparar webhook do André para o MCF Pay

Você já ajustou o MCF Pay para casar pelo `customer.email/phone/name`. Vou reenviar o disparo e validar.

### Execução

1. POST `/notify-mcf-pay` via `supabase--curl_edge_functions` com `{ deal_id: "16e243e9-31e6-4c11-b29b-8447a46d0e8a", force: true }`.
2. Ler o último registro de `mcf_pay_dispatch_logs` para esse deal: esperar `status=success`, `http_status=200`, `response.ok=true` e idealmente um `response.matched_by` indicando qual chave casou.
3. Reportar payload enviado + resposta. Se ainda vier `purchase_not_found_yet` ou outro erro, abro um diagnóstico (provavelmente algo no normalizador do MCF Pay).

Sem alteração de código.