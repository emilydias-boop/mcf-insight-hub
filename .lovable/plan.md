

## Mostrar etapas do Clint no editor de pipeline

### Problema
O `PipelineStagesEditor` só consulta `local_pipeline_stages`. Pipelines sincronizadas do Clint (como "Perpétuo - X1") têm etapas apenas em `crm_stages`, então o editor mostra vazio.

### Impacto nos deals existentes
**Nenhum.** Os deals referenciam `crm_stages.id` via FK. A importação copia dados para `local_pipeline_stages` usando os **mesmos UUIDs**, e qualquer edição é espelhada de volta em `crm_stages`. Os deals continuam apontando para os mesmos IDs.

### Mudanças

**Arquivo:** `src/components/crm/PipelineStagesEditor.tsx`

#### 1. Query de fallback para crm_stages (linha ~62-74)
Adicionar uma segunda query que busca `crm_stages` filtrada por `origin_id = targetId` (quando targetType é 'origin'). Habilitada apenas quando `local_pipeline_stages` retorna vazio.

#### 2. Exibição read-only quando só tem crm_stages
Quando `stages` está vazio mas `crmStages` tem dados, mostrar a lista das etapas com cores, em modo read-only, com aviso "Etapas sincronizadas do Clint CRM".

#### 3. Botão "Importar para edição local"
Mutation que faz bulk insert em `local_pipeline_stages` a partir dos dados de `crm_stages`, preservando os mesmos IDs:
```typescript
const importData = crmStages.map(s => ({
  id: s.id,  // mesmo UUID — mantém FK dos deals
  name: s.stage_name,
  color: s.color,
  stage_order: s.stage_order,
  origin_id: targetId,
  stage_type: 'normal',
}));
await supabase.from('local_pipeline_stages').upsert(importData, { onConflict: 'id' });
```

Após importar, invalidar queries e o editor muda para o modo editável normal (drag & drop, rename, etc).

### Detalhes técnicos

| Item | Detalhe |
|------|---------|
| Arquivo | `src/components/crm/PipelineStagesEditor.tsx` |
| Segurança | Mesmos UUIDs = nenhum deal perde referência |
| Comportamento | Pipelines locais: sem mudança. Pipelines Clint: mostra etapas + botão importar |

