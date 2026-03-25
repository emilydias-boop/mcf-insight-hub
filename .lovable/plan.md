

## Fix: Modal "Enviar para Pipeline" not advancing after BU selection

### Root cause
The modal has a strict cascade: BU -> Groups -> Origins -> Stages. Line 128 checks `groups && groups.length > 0` to show the Funil dropdown. But if the BU "incorporador" has **no groups** mapped in `bu_origin_mapping` (only direct origins), the groups query returns empty and no next step ever appears.

### Solution
Handle both scenarios in the modal:
1. **BU has groups mapped**: show Groups -> Origins (from group) -> Stages (current flow)
2. **BU has direct origins mapped (no groups)**: skip Groups, show Origins directly from `buMapping.origins` -> Stages

### Changes in `src/components/crm/SendToPipelineModal.tsx`

- Add a new query to fetch origins directly from `buMapping.origins` when no groups exist
- Compute `hasGroups = buMapping?.groups?.length > 0` and `hasDirectOrigins = buMapping?.origins?.length > 0`
- When `hasGroups` is false but `hasDirectOrigins` is true, show origins dropdown directly (fetched by IDs from `buMapping.origins`)
- When `hasGroups` is true, keep current cascade (group -> origins from group)
- Merge both origin sources into one `availableOrigins` list for the Pipeline select

### Technical detail

```tsx
// New query for direct origins (when no groups)
const { data: directOrigins } = useQuery({
  queryKey: ['direct-origins-for-bu', selectedBU, buMapping?.origins],
  queryFn: async () => {
    if (!buMapping?.origins?.length) return [];
    const { data } = await supabase
      .from('crm_origins')
      .select('id, name, display_name')
      .in('id', buMapping.origins)
      .order('name');
    return data || [];
  },
  enabled: !!selectedBU && !!buMapping && !buMapping.groups?.length && (buMapping.origins?.length ?? 0) > 0,
});

const hasGroups = (buMapping?.groups?.length ?? 0) > 0;

// Show Pipeline select when:
// - hasGroups && selectedGroupId (current behavior via group origins)
// - !hasGroups && directOrigins exist (skip group step)
const availableOrigins = hasGroups ? origins : directOrigins;
const showOrigins = hasGroups ? !!selectedGroupId : !!selectedBU;
```

This ensures that BUs with only direct origin mappings will show the pipeline dropdown immediately after BU selection.

