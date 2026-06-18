## Causa

O commit de 25/05/2026 em `supabase/functions/twilio-whatsapp-send/index.ts` adicionou validação que exige `Authorization: Bearer <jwt>` com `claims.sub` de usuário. O cron `automation-processor` chama essa função via `supabase.functions.invoke` usando o **service role key** como Bearer — token sem `sub` → cai no `Unauthorized` 401 → vira "Falhou" no log de envios (560 falhas).

## Correção

Editar `supabase/functions/twilio-whatsapp-send/index.ts` para aceitar dois tipos de chamador autenticado:

1. **Service role** (server-to-server): Bearer igual a `SUPABASE_SERVICE_ROLE_KEY` ou claim `role === 'service_role'` → autorizado.
2. **Usuário final**: claim `sub` presente (fluxo atual) → autorizado.
3. Caso contrário → 401.

Lógica:

```text
Bearer <token>
  ├─ token === SUPABASE_SERVICE_ROLE_KEY  → ok (sistema)
  ├─ getClaims().role === 'service_role'  → ok (sistema)
  ├─ getClaims().sub presente             → ok (usuário)
  └─ senão                                → 401
```

Sem mudança de schema, frontend, credenciais Twilio ou `automation-processor`.

## Validação

1. Deploy do `twilio-whatsapp-send`.
2. Aguardar próximo tick do cron (≤5 min) e checar logs da função — esperado: `Message sent: SM...`.
3. Em `automation_logs` (ou `/admin/automacoes` → Logs): novos envios com `status='sent'` e `external_id` preenchido.

## Arquivos

- `supabase/functions/twilio-whatsapp-send/index.ts`
