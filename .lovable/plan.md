

# Fix "Sem nome" in Acumulados — Case-Sensitive Email Matching

## Root Cause
In `useR2AccumulatedLeads.ts`, emails from `hubla_transactions` are lowercased (line 85-89), but `crm_contacts.email` stores emails with original casing (e.g., `Lucastotini@hotmail.com`). The Supabase `.in('email', emails)` filter is case-sensitive, so contacts with mixed-case emails aren't found — causing `contactData` to be null and names to show as "Sem nome".

## Fix
In `src/hooks/useR2AccumulatedLeads.ts`:

1. **Keep original-case emails from transactions** alongside the lowered versions
2. **Query contacts with both variants** to catch case mismatches:
   ```ts
   const originalEmails = uniqueContracts
     .map(t => (t.customer_email || '').trim())
     .filter(Boolean);
   const allEmailVariants = [...new Set([...emails, ...originalEmails])];
   
   const { data: contacts } = await supabase
     .from('crm_contacts')
     .select('id, name, email, phone')
     .in('email', allEmailVariants);
   ```
3. **Normalize the emailToContact map** to always use lowercase keys:
   ```ts
   for (const c of contacts || []) {
     if (c.email) emailToContact.set(c.email.toLowerCase().trim(), c);
   }
   ```

This ensures contacts are found regardless of email casing in either table, and names display correctly.

