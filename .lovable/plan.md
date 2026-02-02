
# Plano: Conectar Configuração de BU aos Componentes do CRM

## Problema Identificado

Os dados estão sendo salvos corretamente na tabela `bu_origin_mapping`:

| BU | Grupos Configurados |
|----|---------------------|
| consorcio | 5 grupos |
| incorporador | 1 grupo |

Porém, os componentes do CRM ainda usam as constantes **hardcoded** em vez do hook dinâmico que busca do banco.

---

## Arquivos que Precisam de Atualização

### 1) `src/components/crm/QuickScheduleModal.tsx`

**Problema atual (linha 115)**:
```typescript
const originIds = activeBU ? BU_PIPELINE_MAP[activeBU] : undefined;
```

**Solução**:
```typescript
import { useBUPipelineMap } from '@/hooks/useBUPipelineMap';

// Dentro do componente
const { data: buMapping } = useBUPipelineMap(activeBU);
const originIds = buMapping?.groups && buMapping.groups.length > 0 
  ? buMapping.groups 
  : undefined;
```

---

### 2) `src/pages/crm/Negocios.tsx`

**Problema atual (linhas 76-85)**:
```typescript
const buAuthorizedOrigins = useMemo(() => {
  if (!activeBU) return [];
  return BU_PIPELINE_MAP[activeBU] || [];
}, [activeBU]);

const buAllowedGroups = useMemo(() => {
  if (!activeBU) return [];
  return BU_GROUP_MAP[activeBU] || [];
}, [activeBU]);
```

**Solução**:
```typescript
import { useBUPipelineMap } from '@/hooks/useBUPipelineMap';

// Dentro do componente
const { data: buMapping, isLoading: isBuMappingLoading } = useBUPipelineMap(activeBU);

const buAuthorizedOrigins = useMemo(() => {
  if (!activeBU || !buMapping) return [];
  return buMapping.origins.length > 0 ? buMapping.origins : buMapping.groups;
}, [activeBU, buMapping]);

const buAllowedGroups = useMemo(() => {
  if (!activeBU || !buMapping) return [];
  return buMapping.groups;
}, [activeBU, buMapping]);
```

---

## Fluxo de Dados Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│          /admin/configuracao-bu                                     │
│  Usuário seleciona BU → marca grupos → Salva                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│          Tabela: bu_origin_mapping                                  │
│  [consorcio, group, b98e3746-d727-...]                              │
│  [consorcio, group, 267905ec-8fcf-...]                              │
│  [incorporador, group, a6f3cbfc-...]                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│          Hook: useBUPipelineMap('consorcio')                        │
│  Retorna: { groups: ['b98e3746-...', '267905ec-...'], origins: [] } │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  QuickScheduleModal      │  │  Negocios.tsx            │
│  → Filtra deals por      │  │  → Filtra kanban por     │
│    grupos da BU          │  │    grupos da BU          │
└──────────────────────────┘  └──────────────────────────┘
```

---

## Alterações Necessárias

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/QuickScheduleModal.tsx` | Substituir `BU_PIPELINE_MAP` por `useBUPipelineMap` |
| `src/pages/crm/Negocios.tsx` | Substituir `BU_PIPELINE_MAP` e `BU_GROUP_MAP` por `useBUPipelineMap` |

---

## Resultado Esperado

Após a correção:
1. Configurações salvas em `/admin/configuracao-bu` serão refletidas imediatamente no CRM
2. Cada BU verá apenas os funis/grupos configurados para ela
3. Novas BUs (Leilão, etc.) funcionarão automaticamente após configuração
4. Fallback para hardcoded mantido caso a tabela esteja vazia
