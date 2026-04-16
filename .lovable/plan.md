

## Correção: Proteção contra duplicados nas 3 Edge Functions

### Problema
As edge functions `webhook-lead-receiver`, `webhook-live-leads` e `import-spreadsheet-leads` verificam duplicação apenas por `contact_id` exato. Se existem múltiplos registros de contato com o mesmo telefone/email, o check falha.

### Solução

Criar uma **função SQL reutilizável** que centraliza a lógica de detecção de duplicados, e usar nas 3 edge functions.

#### 1. Migration: criar função `check_duplicate_deal_by_identity`

```sql
CREATE OR REPLACE FUNCTION public.check_duplicate_deal_by_identity(
  p_email TEXT,
  p_phone_suffix TEXT,
  p_origin_id UUID
) RETURNS UUID AS $$
  SELECT d.id
  FROM crm_deals d
  JOIN crm_contacts c ON c.id = d.contact_id
  WHERE d.origin_id = p_origin_id
    AND d.is_duplicate = false
    AND d.archived_at IS NULL
    AND (
      (p_email IS NOT NULL AND p_email != '' AND LOWER(c.email) = LOWER(p_email))
      OR
      (p_phone_suffix IS NOT NULL AND p_phone_suffix != '' AND c.phone LIKE '%' || p_phone_suffix)
    )
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

#### 2. Atualizar `import-spreadsheet-leads/index.ts`
- Antes de criar deal, chamar `supabase.rpc('check_duplicate_deal_by_identity', { p_email, p_phone_suffix, p_origin_id })`.
- Se retornar um deal_id, tratar como "já existe" (atualizar tags, skip criação).

#### 3. Atualizar `webhook-live-leads/index.ts`
- Após encontrar/criar contato, antes de criar deal: chamar o RPC.
- Se retornar deal_id, retornar `{ action: 'skipped', reason: 'deal_already_exists' }`.

#### 4. Atualizar `webhook-lead-receiver/index.ts`
- No check de deal existente (linha ~607-615), substituir o `.eq('contact_id', contactId)` pelo RPC.
- Se retornar deal_id, seguir o fluxo de "deal já existe" com esse ID.

### Arquivos alterados
- **Migration SQL** — 1 função
- `supabase/functions/import-spreadsheet-leads/index.ts` — substituir check por RPC
- `supabase/functions/webhook-live-leads/index.ts` — substituir check por RPC
- `supabase/functions/webhook-lead-receiver/index.ts` — substituir check por RPC

