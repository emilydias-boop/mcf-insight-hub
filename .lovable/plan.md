
# Plano: Corrigir Filtro de Sub-Origens na Sidebar do CRM

## Problema Identificado

Quando um grupo (funil) é selecionado no dropdown, as sub-origens não aparecem na lista porque:

1. **`buAuthorizedOrigins`** contém IDs de **grupos** (não origens):
   ```
   buAuthorizedOrigins = ['f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'] // ID do grupo BU-LEILÃO
   ```

2. **`useCRMOriginsByPipeline`** retorna as **origens filhas** do grupo:
   ```
   pipelineOrigins = [
     { id: '7d7b1cb5-...', name: 'Efeito Alavanca + Clube', group_id: 'f8a2b3c4-...' },
     { id: 'a1b2c3d4-...', name: 'Pipeline Leilão', group_id: 'f8a2b3c4-...' }
   ]
   ```

3. **Filtro em `OriginsSidebar`** compara os IDs das origens com os IDs dos grupos:
   ```typescript
   // Atual - não funciona porque compara origem com grupo
   (originData as Origin[]).filter(origin => 
     allowedOriginIds!.includes(origin.id) // '7d7b1cb5-...' não está em ['f8a2b3c4-...']
   );
   ```

---

## Solução

Modificar o filtro `filteredByBU` no `OriginsSidebar.tsx` para aceitar origens cujo `group_id` esteja na lista de IDs permitidos.

### Alteração no arquivo `src/components/crm/OriginsSidebar.tsx`

```typescript
const filteredByBU = useMemo(() => {
  if (!originData || !hasBUFilter) return originData;
  
  // Verificar se é uma lista flat ou árvore
  if (Array.isArray(originData) && originData.length > 0 && 'children' in originData[0]) {
    // É árvore (grupos com children)
    return (originData as Group[])
      .map(group => {
        // Verificar se o grupo inteiro está permitido
        if (allowedOriginIds!.includes(group.id)) {
          return group;
        }
        // Filtrar apenas origens permitidas dentro do grupo
        const filteredChildren = group.children.filter(child => 
          allowedOriginIds!.includes(child.id) ||
          (child.group_id && allowedOriginIds!.includes(child.group_id)) // NOVO: verificar group_id
        );
        if (filteredChildren.length === 0) return null;
        return { ...group, children: filteredChildren };
      })
      .filter(Boolean) as Group[];
  } else {
    // É lista flat - CORREÇÃO PRINCIPAL
    return (originData as Origin[]).filter(origin => 
      allowedOriginIds!.includes(origin.id) ||
      // NOVO: Se origin.group_id está na lista de permitidos, a origem também é permitida
      (origin.group_id && allowedOriginIds!.includes(origin.group_id))
    );
  }
}, [originData, allowedOriginIds, hasBUFilter]);
```

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Dropdown de Funil: "BU - LEILÃO" selecionado                       │
│  selectedPipelineId = 'f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  useCRMOriginsByPipeline('f8a2b3c4-...')                            │
│  Retorna lista flat das origens filhas:                             │
│  [                                                                  │
│    { id: '7d7b1cb5-...', name: 'Efeito Alavanca', group_id: 'f8a2b3c4-...' }  │
│    { id: 'a1b2c3d4-...', name: 'Pipeline Leilão', group_id: 'f8a2b3c4-...' }  │
│  ]                                                                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  allowedOriginIds = ['f8a2b3c4-...']  (ID do grupo)                 │
│                                                                     │
│  Filtro CORRIGIDO:                                                  │
│  origin.id === 'f8a2b3c4-...' ? false                               │
│  origin.group_id === 'f8a2b3c4-...' ? TRUE ✓                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Resultado: Ambas origens aparecem na lista                        │
│  ☑ Efeito Alavanca + Clube                                          │
│  ☑ Pipeline Leilão                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/OriginsSidebar.tsx` | Adicionar verificação de `group_id` no filtro `filteredByBU` |

---

## Resultado Esperado

1. Ao selecionar "BU - LEILÃO" no dropdown de funil, as origens filhas aparecerão na lista:
   - Efeito Alavanca + Clube
   - Pipeline Leilão

2. O mesmo funcionará para todas as outras BUs que têm grupos configurados

3. O filtro permanece funcionando para origens diretas (sem grupo)
