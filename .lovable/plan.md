

# Fix: useActiveMetricsForSdr picking wrong comp_plan for month

## Problem

In `src/hooks/useActiveMetricsForSdr.ts` (lines 74-81), the query to get `cargo_catalogo_id` from `sdr_comp_plan` simply orders by `vigencia_inicio DESC` and takes the first result. This means:

- **Julio March**: picks April plan (N1, `2026-04-01`) instead of March plan (N2, `2026-03-01`) → gets 30% instead of 35%
- **Thayna March**: picks April plan (N2, `2026-04-01`) instead of March plan (N3, `2026-03-01`) → gets 35% instead of 40%

## Fix

Filter the comp_plan query to only match plans whose vigencia covers the requested `anoMes`:

```typescript
// Lines 74-81 in useActiveMetricsForSdr.ts
const monthStart = `${anoMes}-01`;
const { data: compPlanData } = await supabase
  .from('sdr_comp_plan')
  .select('cargo_catalogo_id')
  .eq('sdr_id', sdrId)
  .neq('status', 'REJECTED')
  .lte('vigencia_inicio', monthStart)
  .or(`vigencia_fim.gte.${monthStart},vigencia_fim.is.null`)
  .order('vigencia_inicio', { ascending: false })
  .limit(1)
  .maybeSingle();
```

This ensures for March (`2026-03-01`):
- Julio: matches the March plan (N2, vigencia `03-01` to `03-31`) → cargo N2 → meta_percentual=35%
- Thayna: matches the March plan (N3, vigencia `03-01` to `03-31`) → cargo N3 → meta_percentual=40%

Additionally, fix the failed migration for Thayna's old plan. The previous migration used UUID `4884ed45-6f6b-4b5b-a2da-4b2e2b4a7e5a` but the actual ID is `4884ed45-2e58-4564-b7a0-77aa474a7b36`. Need a new migration with the correct UUID.

## Files

| File | Change |
|---|---|
| `src/hooks/useActiveMetricsForSdr.ts` | Filter comp_plan query by anoMes period |
| `supabase/migrations/*.sql` | Close Thayna's old plan with correct UUID |

