

# Fix: Search not finding deals beyond 10,000 limit

## Problem

The Pipeline de Vendas has 10,000+ deals. The current implementation:
1. Fetches up to 10,000 deals client-side (`limit: 10000` in Negocios.tsx line 259)
2. Search filtering happens **in the browser** on those 10,000 deals (lines 401-420)
3. Deals beyond the 10,000 limit are invisible to search

Simply increasing the limit (e.g., to 50,000) is not viable -- it would make the page extremely slow and use excessive memory.

## Solution: Move search to the backend (Supabase query)

When the user types a search term, apply the filter **server-side** using Supabase's `or()` and `ilike()` operators. This way, the search queries the entire database, not just the first 10,000 rows.

## Changes

| File | Change |
|---|---|
| `src/hooks/useCRMData.ts` | In `useCRMDeals`, when `searchTerm` is present, add `.or()` filter to query `name`, `crm_contacts.name`, `crm_contacts.email`, `crm_contacts.phone` server-side |
| `src/pages/crm/Negocios.tsx` | Remove the client-side search filter in `filteredDeals` (lines 407-420) since it's now handled by the backend |

## Technical detail

In `useCRMData.ts`, after line 444, add:

```typescript
if (filters.searchTerm && filters.searchTerm.trim().length >= 2) {
  const term = filters.searchTerm.trim();
  query = query.or(
    `name.ilike.%${term}%,crm_contacts.name.ilike.%${term}%,crm_contacts.email.ilike.%${term}%,crm_contacts.phone.ilike.%${term}%`
  );
}
```

This ensures search works across **all** deals in the database, regardless of the limit. The 10,000 limit still applies to the results shown (but a search for "João" will find all matches, not just within the first 10k).

