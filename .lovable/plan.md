

# Fix: Server-side search failing with PostgREST error

## Problem

The `.or()` filter with related table columns (`crm_contacts.name`, `crm_contacts.email`, etc.) is not supported by PostgREST inside `or()`. This causes a 400 error:

```
"failed to parse logic tree ((name.ilike.%...%,crm_contacts.name.ilike.%...%))"
```

The search in Contatos works because it queries `crm_contacts` directly. The search in Negocios (Pipeline) fails because it tries to filter on joined table columns inside `.or()`.

## Solution

When a `searchTerm` is present, run a **two-step query**:

1. First, query `crm_contacts` to find matching contact IDs by name/email/phone
2. Then query `crm_deals` with `.or()` using only deal-level columns: `name.ilike.%term%` OR `contact_id.in.(matched_ids)`

This avoids the PostgREST limitation entirely.

## Changes

| File | Change |
|---|---|
| `src/hooks/useCRMData.ts` | Replace the broken `.or()` with a two-step approach: first find contact IDs, then filter deals by `name` OR `contact_id.in.(...)` |

### Implementation detail (line ~446-452 in useCRMData.ts)

```typescript
if (filters.searchTerm && filters.searchTerm.trim().length >= 2) {
  const term = filters.searchTerm.trim();
  
  // Step 1: Find matching contact IDs
  const { data: matchingContacts } = await supabase
    .from('crm_contacts')
    .select('id')
    .or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
    .limit(500);
  
  const contactIds = matchingContacts?.map(c => c.id) || [];
  
  // Step 2: Filter deals by name OR matching contact_id
  if (contactIds.length > 0) {
    query = query.or(`name.ilike.%${term}%,contact_id.in.(${contactIds.join(',')})`);
  } else {
    query = query.ilike('name', `%${term}%`);
  }
}
```

Also remove origin_id filter when searching (cross-pipeline search) since the user may want to find deals in any pipeline.

