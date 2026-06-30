## Adicionar `purchase_ref.transaction_id` ao payload do `notify-mcf-pay`

### Mudança em `supabase/functions/notify-mcf-pay/index.ts`

1. Em `resolveCodesForDeal`, ler também `custom_fields.mcf_pay_transaction_id` do deal (já vem no `select` atual via `custom_fields`).
2. Retornar `transaction_id` junto com `closer_code`, `sdr_code`, `customer`.
3. No bloco que monta o `payload` (caminho não-test), preencher:
   ```ts
   purchase_ref: codes.transaction_id ? { transaction_id: codes.transaction_id } : {}
   ```
   Mantém o objeto vazio quando não há transação vinculada (comportamento atual).

### Execução

1. Editar o arquivo acima (deploy automático).
2. Redisparar via `supabase--curl_edge_functions` POST `/notify-mcf-pay` com `{ deal_id: "16e243e9-31e6-4c11-b29b-8447a46d0e8a", force: true }`.
3. Conferir em `mcf_pay_dispatch_logs` o novo registro: esperar `response.ok=true` agora que o MCF Pay consegue casar pela `transaction_id` `pay_348fwsh5ngpkxypn`.
4. Reportar resultado.

Sem mudanças de schema, sem migrações.