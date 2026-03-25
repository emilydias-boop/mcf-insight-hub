

## Esconder sidebar quando BU tem apenas 1 pipeline (grupo ou origem)

### Problema
Quando a BU está mapeada para uma única **origem** (como "PIPELINE INSIDE SALES"), o sistema não reconhece como "single pipeline" porque `buAllowedGroups` só conta grupos. A sidebar aparece mostrando apenas 1 item — redundante.

### Solução

**Arquivo:** `src/pages/crm/Negocios.tsx`

Alterar a lógica de `hasSinglePipeline` para considerar tanto grupos quanto origens:

```typescript
// Antes (só conta grupos):
const hasSinglePipeline = buAllowedGroups.length === 1;

// Depois (conta total de mapeamentos):
const totalMappedPipelines = buAllowedGroups.length + (buMapping?.origins?.length || 0);
const hasSinglePipeline = totalMappedPipelines === 1;
```

Também ajustar a auto-seleção (~linha 176) para considerar origens quando não há grupos:

```typescript
// Se há apenas 1 origem mapeada (sem grupo), auto-selecionar
if (buAllowedGroups.length === 0 && buMapping?.origins?.length === 1) {
  setSelectedPipelineId(buMapping.origins[0]);
  return;
}
```

E ajustar o `PipelineConfigModal` (~linha 827) para usar o ID correto quando é uma origem:

```typescript
const singlePipelineId = buAllowedGroups[0] || buMapping?.origins?.[0];
const singlePipelineType = buAllowedGroups.length === 1 ? 'group' : 'origin';
```

### Resultado
- 1 pipeline mapeada (grupo ou origem) → sidebar escondida, título mostra nome da pipeline
- 2+ pipelines → sidebar visível normalmente

| Item | Detalhe |
|------|---------|
| Arquivo | `src/pages/crm/Negocios.tsx` |
| Linhas | ~103-108, ~176-180, ~600-604, ~827-833 |
| Impacto | Apenas visual, nenhuma mudança em dados |

