
# Correção: Sincronização de owner_profile_id na Transferência em Massa

## Problema Identificado

A transferência em massa de leads atualizou o campo **`owner_id` (email)** mas **não atualizou o campo `owner_profile_id` (UUID)**. 

**Evidência do banco de dados:**
- 66 deals têm `owner_id = alex.dias@minhacasafinanciada.com` (correto)
- Mas o `owner_profile_id` ainda aponta para **Vinicius** (`992a3790-424f-4126-8ef1-e329e2003f99`)

O filtro de owner na página Negócios usa `owner_profile_id`, então quando você filtra por Alex, esses deals não aparecem.

---

## Causa Raiz

Há dois locais no código que atualizam ownership mas **não atualizam `owner_profile_id`**:

| Arquivo | Linha | Problema |
|---------|-------|----------|
| `src/hooks/useOrphanDeals.ts` | 186 | Atualiza só `owner_id` |
| `src/hooks/useAgendaData.ts` | 1455 | Atualiza só `owner_id` |

Possivelmente a transferência usou um desses métodos (ou foi feita via outro mecanismo).

---

## Solução em 2 Partes

### Parte 1: Query de Correção Imediata (SQL)

Executar uma query para sincronizar os 66 deals do Alex:

```sql
UPDATE crm_deals d
SET owner_profile_id = p.id
FROM profiles p
WHERE d.owner_id = p.email
  AND d.owner_id = 'alex.dias@minhacasafinanciada.com'
  AND d.owner_profile_id != p.id;
```

### Parte 2: Correção no Código

**Arquivo: `src/hooks/useOrphanDeals.ts`**

Atualizar a mutation `useBulkAssignOwner` para também atualizar `owner_profile_id`:

- Receber o `profile_id` do novo owner
- Atualizar ambos campos: `owner_id` e `owner_profile_id`

**Arquivo: `src/hooks/useAgendaData.ts`**

Na função `syncDealStageFromAgenda`, quando transfere ownership para o closer:
- Buscar o `profile_id` do closer pelo email
- Atualizar `owner_id` **e** `owner_profile_id`

---

## Alterações Detalhadas

### useOrphanDeals.ts

**Antes:**
```typescript
mutationFn: async ({ dealIds, ownerId }: { dealIds: string[]; ownerId: string }) => {
  const { error } = await supabase
    .from('crm_deals')
    .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
    .in('id', dealIds);
```

**Depois:**
```typescript
mutationFn: async ({ dealIds, ownerId, ownerProfileId }: { 
  dealIds: string[]; 
  ownerId: string; 
  ownerProfileId?: string;
}) => {
  const updateData: any = { 
    owner_id: ownerId, 
    updated_at: new Date().toISOString() 
  };
  
  if (ownerProfileId) {
    updateData.owner_profile_id = ownerProfileId;
  }
  
  const { error } = await supabase
    .from('crm_deals')
    .update(updateData)
    .in('id', dealIds);
```

### useAgendaData.ts

Na transferência de ownership (linha ~1455), adicionar lookup do profile:

```typescript
// Buscar profile_id do closer
const { data: closerProfile } = await supabase
  .from('profiles')
  .select('id')
  .eq('email', closerEmail)
  .single();

updateData.owner_id = closerEmail;
if (closerProfile) {
  updateData.owner_profile_id = closerProfile.id;
}
```

---

## Resultado Esperado

1. **Imediato**: A query SQL corrige os 66 deals do Alex
2. **Futuro**: Todas as transferências manterão `owner_profile_id` sincronizado

Após executar:
- Filtrar por "Alex Dias" mostrará os ~67 leads corretamente
- Filtrar por "Vinicius" mostrará apenas os leads que realmente são dele
