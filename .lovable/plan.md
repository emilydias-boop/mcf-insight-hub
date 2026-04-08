
# Remover filtro de pipeline (originIds) na busca R2

## Problema

O modal R2 ainda filtra por `originIds` do BU ativo (linha 100-101). O lead "fabio carneiro de azevedo" pode estar numa origin que não está mapeada no `bu_origin_mapping` do BU "incorporador", mesmo que o deal exista nessa BU.

## Mudança

| Arquivo | Alteração |
|---|---|
| `src/components/crm/R2QuickScheduleModal.tsx` | Remover o uso de `buOriginIds` na chamada de `useSearchDealsForSchedule`, passando `undefined` para liberar a busca em todas as pipelines |

### Detalhe (linhas 95-101)

```typescript
// De:
const activeBU = useActiveBU();
const { role, user } = useAuth();
const { data: originIds } = useBUOriginIds(activeBU);

const buOriginIds = originIds && originIds.length > 0 ? originIds : undefined;
const { data: searchResults = [], isLoading: searching } = useSearchDealsForSchedule(searchQuery, buOriginIds, undefined);

// Para:
const { data: searchResults = [], isLoading: searching } = useSearchDealsForSchedule(searchQuery, undefined, undefined);
```

Remover também os imports não usados (`useActiveBU`, `useBUOriginIds`, `useAuth`) se não forem usados em outro lugar do componente.
