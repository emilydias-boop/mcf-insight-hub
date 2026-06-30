## Disparar webhook MCF Pay para o deal do André Stormoski

Códigos validados em `profiles`:
- Millena Mikelly (SDR): `S003` ✅
- William Ferreira (Closer R1): `A003` ✅
- Jessica Martins (Closer R2): não cadastrado — fallback aceito pelo usuário

### Execução

1. Invocar `notify-mcf-pay` via `supabase--curl_edge_functions` com `{ "deal_id": "16e243e9-...", "force": true }` para o deal do André Stormoski (forçar reenvio mesmo já estando em "Contrato Pago").
2. A função vai resolver os códigos via `resolveCodesForDeal`:
   - `closer_code` = `A003` (fallback R1 = William, pois R2/Jessica não tem código)
   - `sdr_code` = `S003` (Millena)
   - `customer` = dados do André (name/email/phone) via `contact_id`
3. Conferir em `mcf_pay_dispatch_logs` o último registro: `payload` enviado, `http_status`, `response.ok`, `signature_preview`.
4. Reportar resultado: payload exato + resposta do MCF Pay.

### Observação para você

Webhook vai com `closer_code=A003` (William). Quando a Jessica cadastrar o código dela em `/usuarios`, é só me pedir que eu redisparo — o callback já é idempotente e preserva `contract_paid_at` (implementado nas turnos anteriores), então o reenvio só atualizará a atribuição de comissão no MCF Pay sem mexer no CRM.

Nenhuma alteração de código nesta etapa.