
# Correção: Foreign Key Violation no Webhook Endpoints

## Problema Identificado

Erro: `insert or update on table "webhook_endpoints" violates foreign key constraint "webhook_endpoints_stage_id_fkey"`

### Causa Raiz

1. Os stages no wizard têm IDs temporários (gerados com `crypto.randomUUID()`)
2. O usuário seleciona "R2 Agendada" no Select de Etapa Inicial → salva o ID temporário
3. Os stages são criados no banco com **novos UUIDs** gerados pelo PostgreSQL
4. O webhook tenta usar o ID temporário que **não existe** na tabela `local_pipeline_stages`

### Fluxo Atual (com erro)

```text
Wizard stages: [{ id: "temp-abc", name: "R2 Agendada", stage_order: 2 }, ...]
                          ↓
User selects initial_stage_id = "temp-abc"
                          ↓
Stages inserted → DB creates new IDs: [{ id: "real-xyz", name: "R2 Agendada", stage_order: 2 }]
                          ↓
Webhook insert with stage_id = "temp-abc" ❌ → FK violation (não existe)
```

## Solução

Modificar `useCreatePipeline.ts` para:

1. **Retornar os IDs dos stages criados** usando `.select()` no insert
2. **Mapear o ID temporário para o ID real** usando `stage_order` como referência
3. **Usar o ID real no webhook**

### Fluxo Corrigido

```text
Wizard stages: [{ id: "temp-abc", name: "R2 Agendada", stage_order: 2 }, ...]
                          ↓
User selects initial_stage_id = "temp-abc" → stage_order = 2
                          ↓
Stages inserted with .select() → returns: [{ id: "real-xyz", stage_order: 2 }]
                          ↓
Map: temp-abc (order 2) → real-xyz (order 2)
                          ↓
Webhook insert with stage_id = "real-xyz" ✓
```

## Mudanças no Código

**Arquivo:** `src/hooks/useCreatePipeline.ts`

### Passo 1: Adicionar variável para mapeamento de stages

```typescript
// Adicionar após linha 20
let stageIdMap: Map<string, string> = new Map();
```

### Passo 2: Modificar criação de stages para retornar IDs

```typescript
// Modificar linhas 76-93
if (data.stages.length > 0) {
  const stagesToInsert = data.stages.map((stage, index) => ({
    name: stage.name,
    color: stage.color,
    stage_order: index,
    stage_type: stage.stage_type,
    origin_id: originId || null,
    group_id: originId ? null : (groupId || data.parent_group_id),
  }));

  const { data: createdStages, error: stagesError } = await supabase
    .from('local_pipeline_stages')
    .insert(stagesToInsert)
    .select('id, stage_order');  // ← Retornar IDs criados

  if (stagesError) throw new Error(`Erro ao criar etapas: ${stagesError.message}`);

  // Criar mapeamento: wizard stage ID → DB stage ID
  if (createdStages) {
    createdStages.forEach((dbStage) => {
      const wizardStage = data.stages.find(s => s.stage_order === dbStage.stage_order);
      if (wizardStage) {
        stageIdMap.set(wizardStage.id, dbStage.id);
      }
    });
  }
}
```

### Passo 3: Usar ID real no webhook

```typescript
// Modificar linhas 116-130
if (data.integration.enabled && data.integration.slug) {
  // Mapear ID temporário para ID real do banco
  let realStageId: string | null = null;
  if (data.integration.initial_stage_id) {
    realStageId = stageIdMap.get(data.integration.initial_stage_id) || null;
  }

  const { error: webhookError } = await supabase
    .from('webhook_endpoints')
    .insert({
      name: data.name,
      slug: data.integration.slug,
      origin_id: originId!,
      stage_id: realStageId,  // ← Usar ID real mapeado
      auto_tags: data.integration.auto_tags.length > 0 ? data.integration.auto_tags : null,
      is_active: true,
    });

  if (webhookError) throw new Error(`Erro ao criar webhook: ${webhookError.message}`);
}
```

## Resultado Esperado

- Pipelines com webhook configurado serão criados com sucesso
- A etapa inicial selecionada será corretamente associada ao webhook
- Se nenhuma etapa for selecionada (padrão), `stage_id` será `null`
