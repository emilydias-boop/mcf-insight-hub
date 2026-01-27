
# Correção: Constraint "local_stages_parent_check" Violada

## Problema Identificado

A constraint `local_stages_parent_check` na tabela `local_pipeline_stages` exige que cada stage pertença a **apenas um** parent (group OU origin), nunca ambos:

```sql
CHECK (
  (group_id IS NOT NULL AND origin_id IS NULL) 
  OR 
  (group_id IS NULL AND origin_id IS NOT NULL)
)
```

No código atual (linhas 78-85 de `useCreatePipeline.ts`), quando um **grupo** é criado, ambos `origin_id` e `group_id` estão sendo preenchidos:

```typescript
const stagesToInsert = data.stages.map((stage, index) => ({
  origin_id: originId,                      // ✓ Preenchido com a origin padrão
  group_id: groupId || data.parent_group_id, // ✓ Preenchido com o grupo
  // ❌ VIOLA A CONSTRAINT: ambos não podem ser NOT NULL
}));
```

## Solução

Associar stages à **origin** quando ela existe, caso contrário ao **group**. 

A lógica correta:
- Se tem `originId` → usar `origin_id: originId, group_id: null`
- Se não tem `originId` (só group) → usar `origin_id: null, group_id: groupId`

Como nosso wizard **sempre** cria uma origin (seja default para grupos ou específica), as stages sempre serão associadas à origin.

## Mudança Necessária

**Arquivo:** `src/hooks/useCreatePipeline.ts`

**Linhas 78-85 - Alterar de:**
```typescript
const stagesToInsert = data.stages.map((stage, index) => ({
  name: stage.name,
  color: stage.color,
  stage_order: index,
  stage_type: stage.stage_type,
  origin_id: originId,
  group_id: groupId || data.parent_group_id,
}));
```

**Para:**
```typescript
const stagesToInsert = data.stages.map((stage, index) => ({
  name: stage.name,
  color: stage.color,
  stage_order: index,
  stage_type: stage.stage_type,
  // Constraint exige apenas UM parent: origin OU group (XOR)
  origin_id: originId || null,
  group_id: originId ? null : (groupId || data.parent_group_id),
}));
```

## Lógica Explicada

| Cenário | originId | groupId | Resultado |
|---------|----------|---------|-----------|
| Criar Grupo | `uuid-origin` | `uuid-group` | origin_id = uuid, group_id = **null** |
| Criar Origin | `uuid-origin` | `null` | origin_id = uuid, group_id = **null** |

## Resultado Esperado

Após a correção, a criação de pipelines (grupos) funcionará corretamente, associando as stages à origin padrão criada automaticamente.
