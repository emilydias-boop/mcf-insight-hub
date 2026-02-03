
# Plano: Corrigir Visibilidade de Pipelines e Origens para SDRs do Consórcio

## Problemas Identificados

### 1. Lógica de `buAuthorizedOrigins` Excludente
**Arquivo:** `src/pages/crm/Negocios.tsx` (linha 82)

A lógica atual escolhe **OU** origens **OU** grupos:
```javascript
return buMapping.origins.length > 0 ? buMapping.origins : buMapping.groups;
```

O Consórcio tem **5 grupos** E **1 origem** mapeados:
- Grupos: Perpétuo, Hubla (3 versões), BU - LEILÃO
- Origem: PIPE LINE - INSIDE SALES

Com a lógica atual, apenas a origem é passada para `allowedOriginIds`, e os grupos são ignorados.

### 2. PipelineSelector Não Usa `skipDedup`
**Arquivo:** `src/components/crm/PipelineSelector.tsx` (linha 64)

O componente chama `useCRMPipelines()` sem `skipDedup=true`, mesmo quando recebe `allowedGroupIds`. Isso causa deduplicação por nome e os grupos mapeados podem ser ocultados.

### 3. Filtro de Sidebar Incompleto
**Arquivo:** `src/components/crm/OriginsSidebar.tsx` (linhas 110-139)

O filtro `filteredByBU` não inclui automaticamente as origens de grupos permitidos quando só grupos são mapeados.

---

## Solução Proposta

### Correção 1: Combinar Grupos E Origens no `buAuthorizedOrigins`

**Arquivo:** `src/pages/crm/Negocios.tsx`

Alterar a lógica para incluir AMBOS:

```typescript
const buAuthorizedOrigins = useMemo(() => {
  if (!activeBU || !buMapping) return [];
  // Combinar grupos E origens (não excludente)
  return [...buMapping.groups, ...buMapping.origins];
}, [activeBU, buMapping]);
```

### Correção 2: Passar Flag `skipDedup` para PipelineSelector

**Arquivo:** `src/components/crm/PipelineSelector.tsx`

Modificar o componente para aceitar e usar o flag:

```typescript
interface PipelineSelectorProps {
  selectedPipelineId: string | null;
  onSelectPipeline: (id: string | null) => void;
  allowedGroupIds?: string[];
  skipDedup?: boolean; // NOVO: flag para pular deduplicação
}

export const PipelineSelector = ({ 
  selectedPipelineId, 
  onSelectPipeline, 
  allowedGroupIds,
  skipDedup = false // Default: false (comportamento atual)
}: PipelineSelectorProps) => {
  // Usar skipDedup quando há filtro de BU
  const shouldSkipDedup = skipDedup || (allowedGroupIds && allowedGroupIds.length > 0);
  const { data: pipelines, isLoading } = useCRMPipelines(shouldSkipDedup);
  // ...
}
```

### Correção 3: Passar `skipDedup` na OriginsSidebar

**Arquivo:** `src/components/crm/OriginsSidebar.tsx`

O componente já recebe `allowedGroupIds`, então precisa passar `skipDedup={true}` para o `PipelineSelector`:

```typescript
<PipelineSelector
  selectedPipelineId={pipelineId || null}
  onSelectPipeline={onSelectPipeline}
  allowedGroupIds={allowedGroupIds}
  skipDedup={allowedGroupIds && allowedGroupIds.length > 0} // NOVO
/>
```

---

## Detalhes Técnicos

### Mapeamento Atual do Consórcio no Banco

| entity_type | entity_name | entity_id |
|-------------|-------------|-----------|
| group | Hubla - Construir Para Alugar | 35361575-... |
| group | BU - LEILÃO (display: BU - Consorcio) | f8a2b3c4-... |
| group | Hubla - Sócios MCF | 210d505f-... |
| group | Hubla - Viver de Aluguel | 267905ec-... |
| group | Perpétuo - Construa para Alugar (default) | b98e3746-... |
| origin | PIPE LINE - INSIDE SALES (default) | 57013597-... |

### Fluxo Corrigido

```text
SDR do Consórcio acessa /consorcio/crm/negocios
  └─ useBUPipelineMap retorna 5 grupos + 1 origem
  └─ buAuthorizedOrigins = [...grupos, ...origens] (6 IDs)
  └─ buAllowedGroups = 5 grupos
  └─ PipelineSelector recebe allowedGroupIds + skipDedup=true
      └─ Dropdown mostra todos os 5 grupos (sem deduplicação por nome)
  └─ OriginsSidebar filtra por todos os 6 IDs
      └─ Mostra origens dos grupos + origem individual
```

---

## Arquivos a Modificar

1. **`src/pages/crm/Negocios.tsx`**
   - Linha 82: Combinar grupos + origens no `buAuthorizedOrigins`

2. **`src/components/crm/PipelineSelector.tsx`**
   - Adicionar prop `skipDedup` e usar quando há filtro de BU

3. **`src/components/crm/OriginsSidebar.tsx`**
   - Passar `skipDedup` para o `PipelineSelector`

---

## Resultado Esperado

- Dropdown mostrará os 5 grupos mapeados para Consórcio
- Sidebar mostrará as origens de cada grupo quando selecionado
- SDRs do Consórcio poderão navegar entre todas as pipelines autorizadas
- Não afeta outras BUs (comportamento inalterado para Incorporador, etc.)
