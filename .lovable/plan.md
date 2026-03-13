

## Backfill A010 Offer Leads com Distribuição para SDRs

### Problema Atual
A função `backfill-a010-offer-leads` cria deals sem `owner_id` — os leads entram no pipeline mas não são atribuídos a nenhum SDR.

### Solução
Adicionar chamada ao RPC `get_next_lead_owner(p_origin_id)` durante a criação de cada deal, igual ao fluxo dos webhooks. Também buscar o `owner_profile_id` correspondente para manter consistência.

### Alteração: `supabase/functions/backfill-a010-offer-leads/index.ts`

No bloco de criação do deal (linhas 203-217), antes do insert:

1. Chamar `supabase.rpc('get_next_lead_owner', { p_origin_id: originId })` para obter o email do próximo SDR
2. Se retornar um email, buscar o `profile.id` correspondente
3. Inserir o deal com `owner_id` e `owner_profile_id` preenchidos
4. Adicionar `distributed: true` nos `custom_fields`
5. Registrar atividade de `owner_change` no `deal_activities` para rastreabilidade

```typescript
// Antes do insert do deal:
let ownerEmail: string | null = null;
let ownerProfileId: string | null = null;

const { data: nextOwner } = await supabase.rpc('get_next_lead_owner', { p_origin_id: originId });
if (nextOwner) {
  ownerEmail = nextOwner;
  const { data: profile } = await supabase
    .from('profiles').select('id').ilike('email', nextOwner).limit(1).maybeSingle();
  ownerProfileId = profile?.id || null;
}

// No insert do deal, adicionar:
owner_id: ownerEmail,
owner_profile_id: ownerProfileId,
custom_fields: { ..., distributed: true, deal_user_original: ownerEmail },
```

### Depois: Executar com `dry_run: false`
Após deploy, chamar a function para criar e distribuir os ~1155 deals.

