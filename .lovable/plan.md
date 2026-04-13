

## Plan: Fix Sidebar — Remove Pipeline Selector and Search, Keep Only "Criar Pipeline"

**Problem:** The previous change tied `hideFilters` to `buAllowedGroups.length > 0`, but `buAllowedGroups` is empty when `activeBU` is `null` (e.g., admin users or users on the global `/crm/negocios` route without a BU profile). So the filter still shows.

**User wants:** Remove the "Funil" dropdown and search bar completely. Keep only the "Criar Pipeline" button and the pipeline origins tree.

### Changes

**File: `src/components/crm/OriginsSidebar.tsx`**

1. Split the current `hideFilters` block so that:
   - The `PipelineSelector` dropdown and search bar are hidden when `hideFilters` is true
   - The "Criar Pipeline" button is **always shown** (moved outside the `hideFilters` conditional)
2. Restructure the render so the "Criar Pipeline" button appears in its own `<div>` block that renders regardless of `hideFilters`

**File: `src/pages/crm/Negocios.tsx`**

1. Change the `hideFilters` condition to also trigger when the sidebar has a small number of visible pipelines, or simply always pass `hideFilters={true}` since the user wants a clean sidebar
2. Simplest approach: `hideFilters={(!!buAllowedGroups && buAllowedGroups.length > 0) || activeBU === 'incorporador'}`
   - This catches both BU-mapped scenarios AND the direct incorporador case regardless of how `buAllowedGroups` resolves

