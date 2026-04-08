

# Fix: Duplicate contacts from webhook race conditions + cleanup

## Root Cause

The `webhook-lead-receiver` function creates duplicate contacts due to two issues:

1. **Race condition**: Two concurrent webhooks (e.g., Hubla + Make) both run `SELECT` before either `INSERT` commits. With `gap_seconds < 1` (e.g., 0.096s for rodrigopopiel), both create separate contacts.

2. **Phone format mismatch**: The email lookup uses `.maybeSingle()` which returns `null` when multiple matches exist (e.g., an already-duplicated contact). The phone fallback fails because phones aren't normalized consistently (`+5511950406830` vs `11950406830`).

**Evidence**: 30 unique emails with 58 duplicate contacts since April 1st. Many with sub-second gaps (race condition) or ~100s gaps (different webhook sources).

## Fix (3 parts)

### Part 1: Database unique index on email

Add a partial unique index to prevent duplicate active contacts with the same email:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_unique_active_email 
ON crm_contacts (lower(email)) 
WHERE email IS NOT NULL AND is_archived = false;
```

This requires first cleaning up existing duplicates (Part 3) before the index can be created, so we'll handle cleanup first, then add the index.

### Part 2: Edge Function - handle conflict on insert

In `webhook-lead-receiver/index.ts` (lines 296-314), wrap the contact INSERT to catch unique violation errors (`23505`) and retry the lookup:

```typescript
const { data: newContact, error: contactError } = await supabase
  .from('crm_contacts')
  .insert({ ... })
  .select('id')
  .single();

if (contactError) {
  if (contactError.code === '23505' && emailTrimmed) {
    // Race condition: another request just created this contact
    const { data: raceContact } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', emailTrimmed)
      .order('created_at', { ascending: true })
      .limit(1);
    if (raceContact?.[0]) {
      contactId = raceContact[0].id;
      existingContact = raceContact[0];
    } else throw contactError;
  } else throw contactError;
}
```

Also fix the email lookup (line 188-193) to use `limit(1)` instead of `.maybeSingle()` to handle pre-existing duplicates gracefully:

```typescript
const { data: contactsByEmail } = await supabase
  .from('crm_contacts')
  .select('id')
  .ilike('email', emailTrimmed)
  .eq('is_archived', false)
  .order('created_at', { ascending: true })
  .limit(1);
existingContact = contactsByEmail?.[0] || null;
```

### Part 3: Cleanup existing duplicates

Use a data operation to archive the 28+ orphan duplicate contacts (those without deals) and merge the ones with deals. Specifically:

1. Archive duplicate contacts that have **no deals** (set `is_archived = true`, `merged_into_contact_id` = principal)
2. For duplicates with deals, remap deals to the oldest contact and archive the duplicate
3. Then create the unique index

## Files

| File | Change |
|---|---|
| `supabase/functions/webhook-lead-receiver/index.ts` | Fix email lookup to use `limit(1)`, handle `23505` conflict on insert |
| `supabase/migrations/*.sql` | Archive duplicates, remap deals, add unique index |

## Impact

- Prevents all future duplicate contacts from concurrent webhooks
- Cleans up ~28 orphan duplicate contacts and merges ~2 that have deals
- No behavioral change for existing valid flows

