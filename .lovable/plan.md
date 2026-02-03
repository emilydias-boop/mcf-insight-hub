

# Plano: Corrigir Busca de Leads no Agendamento do Consórcio

## Problema Identificado

Ao buscar leads no modal de agendamento R1 do Consórcio, leads como "Tiago Raifran" não aparecem, apesar de existirem no pipeline de Negócios.

### Causa Raiz

O código em `QuickScheduleModal.tsx` (linha 117-119) está passando **IDs de grupos** para o hook de busca, mas o filtro é aplicado em `origin_id`:

```typescript
const originIds = buMapping?.groups && buMapping.groups.length > 0 
  ? buMapping.groups    // ❌ Passa IDs de GRUPOS
  : undefined;
```

O hook `useSearchDealsForSchedule` filtra por `origin_id`:
```typescript
dealsQuery = dealsQuery.in('origin_id', originIds);  // ❌ Nunca encontra porque origin_id ≠ group_id
```

### Dados Confirmados

| Entidade | ID | Tipo |
|----------|-----|------|
| Lead "Tiago Raifran" | `origin_id = 7d7b1cb5-...` | Origin "Efeito Alavanca + Clube" |
| Grupo pai | `f8a2b3c4-...` | Group "BU - LEILÃO" |
| Mapeamento Consórcio | `f8a2b3c4-...` | Group (entity_type=group) |

A busca passa o group_id, mas o deal tem origin_id → não há match.

---

## Solução Proposta

Criar um novo hook `useBUOriginIds` que expande grupos para suas origens filhas, garantindo que a busca use IDs de origens reais.

### Alterações

**Arquivo 1: `src/hooks/useBUPipelineMap.ts`**

Adicionar novo hook `useBUOriginIds` que:
1. Recebe o mapeamento da BU
2. Se há grupos mapeados, busca todas as origens filhas desses grupos
3. Combina com origens mapeadas diretamente
4. Retorna lista final de origin IDs para filtrar

```typescript
export function useBUOriginIds(bu: BusinessUnit | null) {
  const { data: buMapping } = useBUPipelineMap(bu);
  
  return useQuery({
    queryKey: ['bu-origin-ids', bu, buMapping?.groups],
    queryFn: async () => {
      if (!buMapping) return [];
      
      const directOrigins = buMapping.origins || [];
      
      // Se há grupos, buscar origens filhas
      if (buMapping.groups && buMapping.groups.length > 0) {
        const { data: childOrigins } = await supabase
          .from('crm_origins')
          .select('id')
          .in('group_id', buMapping.groups);
        
        const childOriginIds = childOrigins?.map(o => o.id) || [];
        return [...new Set([...directOrigins, ...childOriginIds])];
      }
      
      return directOrigins;
    },
    enabled: !!bu && !!buMapping,
  });
}
```

**Arquivo 2: `src/components/crm/QuickScheduleModal.tsx`**

Substituir:
```typescript
// ANTES (linha 116-119)
const { data: buMapping } = useBUPipelineMap(activeBU);
const originIds = buMapping?.groups && buMapping.groups.length > 0 
  ? buMapping.groups 
  : undefined;
```

Por:
```typescript
// DEPOIS
const { data: buOriginIds = [] } = useBUOriginIds(activeBU);
const originIds = buOriginIds.length > 0 ? buOriginIds : undefined;
```

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  QuickScheduleModal (Consórcio)                                     │
│  ↓                                                                  │
│  useBUOriginIds("consorcio")                                        │
│  ↓                                                                  │
│  buMapping.groups = [f8a2b3c4-..., b98e3746-..., ...]              │
│  ↓                                                                  │
│  Busca crm_origins WHERE group_id IN (grupos)                       │
│  ↓                                                                  │
│  Retorna: [7d7b1cb5-..., 57013597-..., d69dd4ff-..., ...]          │
│        (Efeito Alavanca, PIPELINE INSIDE SALES, etc)                │
│  ↓                                                                  │
│  useSearchDealsForSchedule("Tiago", originIds)                     │
│  ↓                                                                  │
│  Encontra lead com origin_id = 7d7b1cb5-... ✓                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Após a implementação, ao buscar "Tiago Raifran" no modal de agendamento do Consórcio:

| Antes | Depois |
|-------|--------|
| "Nenhum lead encontrado" | Lista com "Tiago Raifran" da origem "Efeito Alavanca + Clube" |

---

## Arquivos Modificados

1. `src/hooks/useBUPipelineMap.ts` - Adicionar hook `useBUOriginIds`
2. `src/components/crm/QuickScheduleModal.tsx` - Usar novo hook para obter origin IDs corretos

