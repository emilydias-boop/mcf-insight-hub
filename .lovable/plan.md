

## Plan: Remove Pipeline Selector and Search from Incorporador Sidebar

**What the user wants:** In the Incorporador BU CRM page, the sidebar currently shows a "Funil" dropdown with many pipelines and a search bar. Since only 2 pipelines are active (PILOTO ANAMNESE / INDICACAO and PIPELINE INSIDE SALES), the user wants to remove the dropdown and search, showing only those 2 pipelines directly.

### Changes

**File: `src/components/crm/OriginsSidebar.tsx`**

1. Add a new prop `hideFilters?: boolean` to `OriginsSidebarProps`
2. When `hideFilters` is true, skip rendering the PipelineSelector section (lines 407-423) and the search bar section (lines 425-436)
3. This keeps the sidebar clean — just favorites + the origin tree/list

**File: `src/pages/crm/Negocios.tsx`**

1. Pass `hideFilters={true}` to `OriginsSidebar` when the BU has a small number of allowed origins (i.e., when `allowedOriginIds` or `allowedGroupIds` are defined and the BU filter is active)
2. Alternatively, derive this from the BU context — if `activeBU === 'incorporador'`, hide filters

### Technical Detail

The simplest approach: when `allowedGroupIds` is provided and has entries, we know the BU is restricting pipelines. If the filtered pipeline count is small (<=5 or just always when BU-filtered), hide the selector and search. The origins will still be filtered by `allowedOriginIds`/`allowedGroupIds` as they are today.

