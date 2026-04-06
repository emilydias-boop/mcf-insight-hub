

# Corrigir Backfill: Unique Constraint + Query Limit

## Problema

Todos os 50+ inserts falharam com `duplicate key value violates unique constraint "crm_deals_contact_origin_unique"`. A causa é dupla:

1. **Limite de 1000 rows do Supabase**: A query que busca deals existentes (linha 84-88) usa `.in('contact_id', contactIds)` com até 500 IDs, mas o Supabase retorna no máximo 1000 rows. Se houver mais deals que isso, alguns contatos parecem "órfãos" mas já têm deal.

2. **Sem tratamento de conflito**: O insert não usa `onConflict` nem trata o erro de constraint, então falha silenciosamente contando como "processado" mas sem criar nada.

## Solução

### Arquivo: `supabase/functions/backfill-orphan-a010-deals/index.ts`

Duas correções:

**1. Buscar deals em batches menores** para evitar o limite de 1000:
```typescript
// Em vez de .in('contact_id', allContactIds) de uma vez
// Dividir em batches de 50 IDs
const contactsWithDeal = new Set<string>();
for (let i = 0; i < contactIds.length; i += 50) {
  const batch = contactIds.slice(i, i + 50);
  const { data: deals } = await supabase
    .from('crm_deals')
    .select('contact_id')
    .eq('origin_id', originId)
    .in('contact_id', batch);
  (deals || []).forEach(d => contactsWithDeal.add(d.contact_id));
}
```

**2. Tratar constraint no insert** — usar `upsert` com `onConflict` ou ignorar erro de duplicata:
```typescript
const { data: newDeal, error: dealError } = await supabase
  .from('crm_deals')
  .upsert({...dealData}, { onConflict: 'contact_id,origin_id', ignoreDuplicates: true })
  .select('id')
  .maybeSingle();
```

Se `ignoreDuplicates` não funcionar com esse constraint name, usar try/catch e pular com log.

## Resultado esperado
- Orphans verdadeiros recebem deals
- Contatos que já têm deal são ignorados sem erro
- Sem impacto do limite de 1000 rows

