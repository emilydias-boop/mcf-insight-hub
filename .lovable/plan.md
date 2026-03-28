

## Fix: Canal classification fails because duplicate contacts are ignored

### Root cause (confirmed by tooltip audit)

The tooltip shows `HasDeal: false, HasContact: true, Tags: []` for Jader (ANAMNESE). This means:

1. **Line 384**: `contactMap.set(email, ...)` — keeps only the **last** contact per email. If Jader has 2 contacts with the same email, one with deals (ANAMNESE tags) and one without, the wrong one may be kept.
2. **Line 437**: `contactIds` is built from `contactMap` values — only one contact_id per email.
3. **Line 442-460**: Deals, R1, R2 are queried only for those contact_ids — the contact with the actual ANAMNESE deal is never queried.

This affects ALL leads with duplicate contacts: ANAMNESE, OUTSIDE, LIVE — any lead where the "wrong" contact was kept.

### Fix

**`src/hooks/useCarrinhoAnalysisReport.ts`**:

1. **Collect ALL contact IDs from the email query**, not just one per email:
```typescript
// Keep contactMap as-is (one per email for later lookup)
// But build contactIds from ALL contacts returned
const allContactIds = Array.from(new Set(
  (contactsResult.data || []).map(c => c.id)
));
```

2. **Use `allContactIds` for deals/R1/R2 queries** (lines 442-460) instead of `contactIds`.

3. **After deals are loaded, pick the best contact per email** — the one with the most data (deals, R1, R2):
```typescript
// For each email with multiple contacts, pick the one with deals
for (const c of contactsResult.data || []) {
  const email = (c.email || '').toLowerCase().trim();
  if (!email) continue;
  const current = contactMap.get(email);
  if (!current) {
    contactMap.set(email, { id: c.id, phone: c.phone });
  } else if (!dealMap.has(current.id) && dealMap.has(c.id)) {
    // Swap to the contact that actually has deals
    contactMap.set(email, { id: c.id, phone: c.phone });
  } else if (dealMap.has(current.id) && dealMap.has(c.id)) {
    // Both have deals — merge tags
    mergeDealsIntoMap(/* already done */);
  }
}
```

4. **Merge deal tags across ALL contacts for the same email** so that even if we pick one contact, the ANAMNESE tag from another contact's deal is preserved.

### Changes summary

- Store all contact IDs for querying, not just one per email
- After loading deals/R1/R2, re-evaluate which contact per email is best
- Merge tags from all duplicate contacts' deals into the chosen contact's deal entry
- This fixes ANAMNESE, OUTSIDE, and any classification that depends on deal data

### File changed
- `src/hooks/useCarrinhoAnalysisReport.ts`

