
# Plano: Filtrar Origens por Business Unit na Sidebar

## Problema Atual

Quando o usuário está na BU Incorporador (rota `/incorporador/crm/negocios` ou perfil BU=incorporador), a sidebar de origens mostra **todos os 65 grupos e 3978 origens** do sistema, quando deveria mostrar apenas:
- **Grupo**: Perpétuo - X1 (`a6f3cbfc-0567-427f-a405-5a869aaa6010`)
- **Origens do grupo**: PIPELINE INSIDE SALES e outras 10 origens dentro deste grupo

---

## Causa Raiz

1. O mapeamento `BU_PIPELINE_MAP` para `incorporador` contém apenas 1 origem:
   ```typescript
   incorporador: ['e3c04f21-ba2c-4c66-84f8-b4341c826b1c'] // PIPELINE INSIDE SALES (origem)
   ```
   Falta incluir o grupo pai `a6f3cbfc-0567-427f-a405-5a869aaa6010` (Perpétuo - X1)

2. O `PipelineSelector` (dropdown "Funil:") não recebe filtro de BU - mostra todos os grupos

3. A lógica de filtro na `OriginsSidebar` está correta, mas precisa receber os IDs corretos

---

## Solução

### Etapa 1: Atualizar mapeamento BU → Pipelines

Adicionar o grupo pai ao mapeamento para cada BU:

| BU | Antes | Depois |
|----|-------|--------|
| incorporador | Apenas 1 origem (PIPELINE INSIDE SALES) | Grupo (Perpétuo X1) + todas origens do grupo |
| consorcio | Grupo + 1 origem (já correto) | Mantém |
| credito | Origem genérica | Grupo específico + origens |
| projetos | Origem genérica | Grupo específico + origens |
| leilao | Origem específica (já correto) | Mantém |

### Etapa 2: Modificar PipelineSelector para aceitar filtro

O componente `PipelineSelector` precisa receber uma prop `allowedGroupIds` para filtrar quais grupos aparecem no dropdown.

### Etapa 3: Passar filtro de grupos para o selector

O componente `OriginsSidebar` passará os grupos permitidos da BU para o `PipelineSelector`.

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/auth/NegociosAccessGuard.tsx` | Atualizar `BU_PIPELINE_MAP` para incluir grupos pais + criar `BU_GROUP_MAP` |
| `src/components/crm/PipelineSelector.tsx` | Adicionar prop `allowedGroupIds` para filtrar dropdown |
| `src/components/crm/OriginsSidebar.tsx` | Passar `allowedGroupIds` baseado na BU ativa |
| `src/pages/crm/Negocios.tsx` | Passar informação de grupos permitidos para sidebar |

---

## Detalhes Técnicos

### 1. Novo mapeamento de grupos por BU

```typescript
// NegociosAccessGuard.tsx

// Grupos que cada BU pode ver no dropdown de funis
export const BU_GROUP_MAP: Record<BusinessUnit, string[]> = {
  incorporador: ['a6f3cbfc-0567-427f-a405-5a869aaa6010'], // Perpétuo - X1
  consorcio: ['b98e3746-d727-445b-b878-fc5742b6e6b8'],    // Perpétuo - Construa para Alugar  
  credito: ['8d33bad6-46ab-4f9c-a570-dc7b74be2ac9'],      // Grupo de Crédito (a definir)
  projetos: [],                                            // A definir
  leilao: ['f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'],       // BU - LEILÃO
};

// Atualizar BU_PIPELINE_MAP para incluir TODAS as origens do grupo
export const BU_PIPELINE_MAP: Record<BusinessUnit, string[]> = {
  incorporador: [
    'a6f3cbfc-0567-427f-a405-5a869aaa6010', // Grupo: Perpétuo - X1
    'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', // Origem: PIPELINE INSIDE SALES
    // + outras 10 origens do grupo automaticamente via lógica de grupo
  ],
  // ... outras BUs
};
```

### 2. PipelineSelector com filtro

```typescript
// PipelineSelector.tsx
interface PipelineSelectorProps {
  selectedPipelineId: string | null;
  onSelectPipeline: (id: string | null) => void;
  allowedGroupIds?: string[]; // NOVO: grupos permitidos pela BU
}

export const PipelineSelector = ({ 
  selectedPipelineId, 
  onSelectPipeline,
  allowedGroupIds 
}: PipelineSelectorProps) => {
  const { data: pipelines, isLoading } = useCRMPipelines();
  
  // Filtrar pipelines se houver restrição de BU
  const filteredPipelines = useMemo(() => {
    if (!allowedGroupIds || allowedGroupIds.length === 0) {
      return pipelines; // Sem filtro = admin vê tudo
    }
    return pipelines?.filter(p => allowedGroupIds.includes(p.id));
  }, [pipelines, allowedGroupIds]);
  
  // ... resto do componente usando filteredPipelines
};
```

### 3. OriginsSidebar passando filtro

```typescript
// OriginsSidebar.tsx
<PipelineSelector
  selectedPipelineId={pipelineId || null}
  onSelectPipeline={onSelectPipeline}
  allowedGroupIds={allowedGroupIds} // Grupos da BU ativa
/>
```

### 4. Negocios.tsx passando grupos

```typescript
// Negocios.tsx
import { BU_GROUP_MAP } from '@/components/auth/NegociosAccessGuard';

// Grupos permitidos baseados na BU ativa
const buAllowedGroups = useMemo(() => {
  if (!activeBU) return []; // Admin vê tudo
  return BU_GROUP_MAP[activeBU] || [];
}, [activeBU]);

// Passar para sidebar
<OriginsSidebar
  allowedOriginIds={buAuthorizedOrigins}
  allowedGroupIds={buAllowedGroups}
  // ...
/>
```

---

## Resultado Esperado

### Para BU Incorporador:
- Dropdown "Funil:" mostra apenas: **Perpétuo - X1**
- Lista de origens mostra apenas as 11 origens do grupo Perpétuo - X1
- PIPELINE INSIDE SALES aparece como origem principal

### Para BU Consórcio:
- Dropdown "Funil:" mostra apenas: **Perpétuo - Construa para Alugar**
- Lista de origens mostra as origens desse grupo

### Para Admin (sem BU):
- Comportamento atual mantido: vê todos os grupos e origens

---

## Benefícios

1. Interface limpa e focada para cada equipe
2. Reduz confusão com pipelines de outras BUs
3. Carregamento mais rápido (menos dados)
4. Consistência com o design de BUs separadas
