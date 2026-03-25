
## What to remove — exact file/line changes

### Confirmed safe list:
1. **Delete files**: `src/pages/bu-consorcio/CRM.tsx`, `src/components/crm/SyncMonitor.tsx`, `src/components/crm/SyncControls.tsx`, `src/components/crm/CronJobSetup.tsx`, `src/pages/EfeitoAlavanca.tsx`, `src/pages/receita/ImportarA010.tsx`
2. **App.tsx**: Remove `import EfeitoAlavanca` (line 44) + `import ImportarA010` (line 34) + the route `<Route path="importar-a010" .../>` (line 197)
3. **CRM.tsx**: Remove the dead `canViewNegocios = true` logic and the unreachable `if` redirect block (lines 20–27), simplifying to just the `canViewR2` check
4. **Configuracoes.tsx (CRM)**: Remove the 3 `settingsSections` entries that have no action: `custom-fields`, `automations`, `stages` (keys that fall through to a no-op in `handleClick`) — keep only `qualification` and `permissions`. Also remove the "Configurações Gerais" card entirely (lines 220–260) — the 3 items inside (Notificações por Email, Integrações, Backup de Dados) have buttons with no onClick.
5. **Delete 13 edge function folders** (none referenced in any .tsx/.ts frontend file):
   - `supabase/functions/backfill-a010-missing-deals/`
   - `supabase/functions/backfill-a010-offer-leads/`
   - `supabase/functions/backfill-construir-alugar/`
   - `supabase/functions/backfill-deal-activities/`
   - `supabase/functions/backfill-deal-owners/`
   - `supabase/functions/fix-backfill-stages/`
   - `supabase/functions/fix-null-stages/`
   - `supabase/functions/fix-r2-ownership/`
   - `supabase/functions/cleanup-backfill-partners/`
   - `supabase/functions/reconcile-clint-ids/`
   - `supabase/functions/repair-activity-owners/`
   - `supabase/functions/reprocess-missing-activities/`
   - `supabase/functions/import-bubble-history/`

### Zero risk confirmation:
- `EfeitoAlavancaRow` (used in Dashboard) is in `src/components/dashboard/EfeitoAlavancaRow.tsx` — different file, not touched
- `backfill-deal-tasks`, `backfill-orphan-owners`, `detect-duplicate-activities`, `move-partners-to-venda-realizada`, `import-hubla-history` are actively used — NOT removed
- No navigation links point to any of these pages/routes

### CRM.tsx simplified redirect logic
```tsx
// Remove canViewNegocios entirely
// The isAgendaOnly block only uses canViewR2 now:
if (isAgendaOnly && !canViewR2 && location.pathname === '/crm') {
  return <Navigate to="/crm/agenda" replace />;
}
// canViewNegocios still referenced in navItems filter — keep as inline true or simplify
```
For the `navItems` filter that also checks `canViewNegocios`, since it's always true the `/crm/negocios` is always in `allowedTabs` for `isAgendaOnly` — just inline it directly without the variable.

### Configuracoes.tsx — sections to remove
`settingsSections` keeps only 2 entries: `qualification` and `permissions`. The other 3 (`custom-fields`, `automations`, `stages`) silently do nothing on click — remove them.

The entire "Configurações Gerais" Card (lines 220–260) with 3 buttons that have no onClick — remove it entirely.

### Files to write (no delete tool — use empty/redirect or just write new content):
Since there's no delete tool, dead files will be replaced with empty exports or the imports will be removed from App.tsx making them unreachable tree-shaken. For edge functions, I'll replace them with a single-line "deprecated" comment or simply remove their index.ts content to make them no-ops (Supabase won't break from empty/stub functions).

Actually the cleanest approach:
- For **React files that are only imported in App.tsx**: remove the import AND the route — the file itself becomes unreachable dead code (tree-shaken in build). Since I can't delete files, I'll make them stub exports.
- For **components** (SyncMonitor, SyncControls, CronJobSetup) that are not imported anywhere: just leave them — they produce zero runtime impact (tree-shaken). But to be thorough, stub them.
- For **edge functions**: replace index.ts with a stub that returns 410 Gone.

**Revised plan — what actually changes:**
1. `src/App.tsx` — remove 2 imports + 1 route (lines 34, 44, 197)
2. `src/pages/CRM.tsx` — remove canViewNegocios dead logic (lines 20–27, 56–58)
3. `src/pages/crm/Configuracoes.tsx` — remove 3 dead settingsSections + the "Configurações Gerais" card
4. Stub 13 edge function `index.ts` files with 410 responses
5. Stub the 5 unreachable React page files (bu-consorcio/CRM.tsx, SyncMonitor, SyncControls, CronJobSetup, EfeitoAlavanca, ImportarA010) — minimal stubs

This is the complete, safe implementation.
