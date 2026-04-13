

## Plan: Show Both Pipelines in Sidebar When Filters Are Hidden

**Problem:** The sidebar receives `pipelineId={selectedPipelineId}` which restricts the origin list to a single pipeline. Since the "Funil" selector is hidden, the user is stuck seeing only the auto-selected pipeline (PIPELINE INSIDE SALES) and can't switch to see PILOTO ANAMNESE / INDICACAO.

**Solution:** When `hideFilters` is active, pass `pipelineId={null}` to the sidebar so it loads ALL origins, which then get filtered by `allowedOriginIds` to show only the 2 permitted pipelines.

### Changes

**File: `src/pages/crm/Negocios.tsx` (line ~705)**

Change the `pipelineId` prop from:
```tsx
pipelineId={selectedPipelineId}
```
to:
```tsx
pipelineId={
  (!!buAllowedGroups && buAllowedGroups.length > 0) || activeBU === 'incorporador'
    ? null  // Show all origins (filtered by BU)
    : selectedPipelineId
}
```

This makes the sidebar load the full origin tree when filters are hidden, and the existing `allowedOriginIds` filtering will narrow it down to just the 2 permitted pipelines.

