
# Plano: Adicionar Fallback para Etapas de Pipelines Legadas

## Problema Identificado

O modal de criação de webhook busca etapas **apenas** em `local_pipeline_stages`, mas:

| Tabela | Pipelines com etapas |
|--------|---------------------|
| `local_pipeline_stages` | **7** |
| `crm_stages` (legada) | **558** |

A maioria das pipelines (como as do Perpétuo X1) ainda usa a tabela legada `crm_stages`, por isso o dropdown de etapas aparece vazio.

---

## Causa Raiz

No arquivo `IncomingWebhookFormDialog.tsx`, a query busca apenas em `local_pipeline_stages`:

```typescript
const { data: stages } = useQuery({
  queryKey: ['local-pipeline-stages', originId],
  queryFn: async () => {
    const { data } = await supabase
      .from('local_pipeline_stages')  // ← Apenas aqui
      .select('id, name, stage_order, is_active')
      .eq('origin_id', originId)
      .eq('is_active', true)
      .order('stage_order');
    return data;
  },
});
```

---

## Solução: Fallback para `crm_stages`

### Lógica

1. Buscar primeiro em `local_pipeline_stages`
2. Se retornar vazio (ou null), buscar em `crm_stages`
3. Normalizar os campos para ter mesma estrutura

### Alteração no Arquivo

**`src/components/crm/webhooks/IncomingWebhookFormDialog.tsx`**

```typescript
// Fetch stages - primeiro local_pipeline_stages, fallback para crm_stages
const { data: stages } = useQuery({
  queryKey: ['pipeline-stages-with-fallback', originId],
  queryFn: async () => {
    // Tentar primeiro em local_pipeline_stages
    const { data: localStages, error: localError } = await supabase
      .from('local_pipeline_stages')
      .select('id, name, stage_order, is_active')
      .eq('origin_id', originId)
      .eq('is_active', true)
      .order('stage_order');
    
    if (!localError && localStages && localStages.length > 0) {
      return localStages;
    }
    
    // Fallback para crm_stages (tabela legada)
    const { data: crmStages, error: crmError } = await supabase
      .from('crm_stages')
      .select('id, stage_name, stage_order')
      .eq('origin_id', originId)
      .order('stage_order');
    
    if (crmError) throw crmError;
    
    // Normalizar campos para manter compatibilidade
    return (crmStages || []).map(s => ({
      id: s.id,
      name: s.stage_name,  // stage_name → name
      stage_order: s.stage_order,
      is_active: true
    }));
  },
  enabled: !!originId,
});
```

---

## Importante: Constraint de FK

Há um problema: `webhook_endpoints.stage_id` tem FK para `local_pipeline_stages`, **não** para `crm_stages`.

Isso significa que:
- Se usarmos IDs de `crm_stages`, o insert vai falhar com erro de FK
- Pipelines legadas precisariam ter suas etapas migradas para `local_pipeline_stages`

### Opções de Resolução

**Opção A: Migração única (recomendada)**
- Rodar script SQL que copia etapas de `crm_stages` para `local_pipeline_stages` onde não existem
- Depois, o frontend funciona sem alteração

**Opção B: Alterar FK no banco**
- Remover/ajustar FK para permitir IDs de ambas as tabelas
- Mais complexo e pode afetar integridade

**Opção C: Criar webhook sem stage_id**
- Permitir criar webhook com `stage_id = null`
- Leads entrariam sem etapa definida (precisaria de lógica de fallback no processamento)

---

## Plano de Ação Recomendado

### Passo 1: Script de Migração (SQL)

```sql
-- Copiar etapas de crm_stages para local_pipeline_stages onde não existem
INSERT INTO local_pipeline_stages (id, origin_id, name, stage_order, is_active, color)
SELECT 
  cs.id,
  cs.origin_id,
  cs.stage_name as name,
  cs.stage_order,
  true as is_active,
  null as color
FROM crm_stages cs
WHERE NOT EXISTS (
  SELECT 1 FROM local_pipeline_stages lps 
  WHERE lps.origin_id = cs.origin_id
)
ON CONFLICT (id) DO NOTHING;
```

Este script:
- Copia todas as etapas de pipelines que só existem em `crm_stages`
- Usa o mesmo ID para manter consistência
- Não afeta pipelines que já têm etapas em `local_pipeline_stages`

### Passo 2: Verificar Resultado

Após rodar o script, a query do frontend (`local_pipeline_stages`) retornará etapas para todas as pipelines.

---

## Resultado Esperado

- Todas as pipelines terão etapas disponíveis no dropdown
- Webhooks poderão ser criados em qualquer pipeline
- FK continua válida (todos os IDs existem em `local_pipeline_stages`)

---

## Resumo

| Etapa | Ação |
|-------|------|
| 1 | Rodar script SQL de migração |
| 2 | Testar criação de webhook nas pipelines que antes falhavam |
| 3 | Confirmar que etapas aparecem no dropdown |
