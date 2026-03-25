

## SDR fixo por webhook endpoint

### Resumo
Adicionar campos `fixed_owner_email` e `fixed_owner_profile_id` na tabela `webhook_endpoints`. Quando preenchidos, o `webhook-lead-receiver` usa esse owner direto sem chamar `get_next_lead_owner`. Configurável via UI no formulário de webhook.

### Alterações

**1. Migration SQL** — novas colunas na tabela `webhook_endpoints`:
```sql
ALTER TABLE webhook_endpoints 
  ADD COLUMN fixed_owner_email text,
  ADD COLUMN fixed_owner_profile_id uuid;
```

**2. Data update** — setar Antony Elias no endpoint `anamnese-incompleta`:
```sql
UPDATE webhook_endpoints 
SET fixed_owner_email = 'antony.elias@minhacasafinanciada.com'
WHERE slug = 'anamnese-incompleta';
```
O `fixed_owner_profile_id` será resolvido automaticamente pela edge function.

**3. `supabase/functions/webhook-lead-receiver/index.ts`** — linhas 427-448:
Antes de chamar `get_next_lead_owner`, verificar `endpoint.fixed_owner_email`:
```typescript
if (endpoint.fixed_owner_email) {
  assignedOwner = endpoint.fixed_owner_email;
  // resolver profile_id
  const { data: ownerProfile } = await supabase
    .from('profiles').select('id').eq('email', assignedOwner).maybeSingle();
  if (ownerProfile) assignedOwnerProfileId = ownerProfile.id;
  console.log('[WEBHOOK-RECEIVER] 🔒 Owner fixo:', assignedOwner);
} else {
  // distribuição normal via get_next_lead_owner (código atual)
}
```

**4. `src/hooks/useWebhookEndpoints.ts`** — adicionar `fixed_owner_email` e `fixed_owner_profile_id` nos tipos `WebhookEndpoint` e `CreateWebhookEndpoint`.

**5. `src/components/crm/webhooks/IncomingWebhookFormDialog.tsx`** — adicionar campo opcional "SDR Fixo" com select de perfis ativos (SDRs/Closers). Quando selecionado, salva o email no `fixed_owner_email`.

### Resultado
- `anamnese-incompleta` → sempre Antony Elias
- Outros webhooks → distribuição normal
- Lead que passa por dois webhooks → mantém owner do primeiro (já funciona)
- Configurável via UI para qualquer endpoint

