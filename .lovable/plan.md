
# Plano: Sincronizar owner_profile_id em TODOS os Webhooks

## Problema
Os 4 webhooks que criam/atualizam deals definem apenas `owner_id` (email) mas **NÃO** sincronizam `owner_profile_id` (UUID). Como o backend filtra por UUID, os leads "somem" do Kanban.

## Arquivos a Modificar

### 1. `supabase/functions/webhook-lead-receiver/index.ts`
Após obter `assignedOwner` do RPC, buscar o profile_id correspondente e incluir no insert do deal.

### 2. `supabase/functions/webhook-live-leads/index.ts`
Mesma correção - buscar profile_id do owner atribuído antes de criar o deal.

### 3. `supabase/functions/clint-webhook-handler/index.ts`
Ao atualizar `owner_id` de um deal, também buscar e salvar o `owner_profile_id`.

### 4. `supabase/functions/hubla-webhook-handler/index.ts`
Ao herdar owner de outro deal, incluir também o `owner_profile_id` (ou buscar se não existir).

## Padrão de Código

Cada webhook fará uma consulta adicional ao profiles:

```typescript
// Buscar owner_profile_id correspondente
const { data: ownerProfile } = await supabase
  .from('profiles')
  .select('id')
  .eq('email', ownerEmail)
  .maybeSingle();

if (ownerProfile) {
  assignedOwnerProfileId = ownerProfile.id;
}
```

## Resultado
- Todos os novos leads terão `owner_id` E `owner_profile_id` sincronizados
- Leads não vão mais "sumir" do Kanban após entrar via webhook
