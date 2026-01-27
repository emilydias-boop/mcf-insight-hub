
# Correção: Foreign Key Aponta para Tabela Errada

## Problema Identificado

A constraint `webhook_endpoints_stage_id_fkey` referencia a tabela **`crm_stages`**, mas o wizard cria stages na tabela **`local_pipeline_stages`**:

```sql
-- Constraint atual:
FOREIGN KEY (stage_id) REFERENCES crm_stages(id) ON DELETE SET NULL

-- Mas os stages são criados em:
local_pipeline_stages
```

Isso significa que, mesmo mapeando corretamente os IDs temporários para os IDs reais do banco, a FK sempre vai falhar porque o ID existe em `local_pipeline_stages`, não em `crm_stages`.

## Opções de Solução

### Opção A: Alterar a FK no banco de dados (Recomendada)
Modificar a constraint para referenciar `local_pipeline_stages` ao invés de `crm_stages`.

```sql
-- Remover constraint antiga
ALTER TABLE webhook_endpoints 
DROP CONSTRAINT webhook_endpoints_stage_id_fkey;

-- Adicionar nova constraint
ALTER TABLE webhook_endpoints 
ADD CONSTRAINT webhook_endpoints_stage_id_fkey 
FOREIGN KEY (stage_id) REFERENCES local_pipeline_stages(id) ON DELETE SET NULL;
```

### Opção B: Workaround no código (Rápida)
Não associar `stage_id` nos webhooks criados via wizard (deixar como `null`), já que a funcionalidade de "etapa inicial" pode ser implementada de outra forma.

## Solução Recomendada

Aplicar a **Opção A** (alterar FK no banco) pois:
1. Mantém a integridade referencial correta
2. O sistema já usa `local_pipeline_stages` para todas as operações de stages
3. A tabela `crm_stages` parece ser legado/sync de sistema externo

## Mudanças Necessárias

### 1. Migração SQL (executar no Supabase SQL Editor)

```sql
-- Alterar FK de webhook_endpoints.stage_id
ALTER TABLE webhook_endpoints 
DROP CONSTRAINT IF EXISTS webhook_endpoints_stage_id_fkey;

ALTER TABLE webhook_endpoints 
ADD CONSTRAINT webhook_endpoints_stage_id_fkey 
FOREIGN KEY (stage_id) REFERENCES local_pipeline_stages(id) ON DELETE SET NULL;
```

### 2. Código já está correto
O código em `useCreatePipeline.ts` já mapeia corretamente os IDs temporários para os IDs reais do `local_pipeline_stages`. Após a migração SQL, funcionará perfeitamente.

## Passos para Implementar

1. Executar a migração SQL no Supabase SQL Editor (ambiente de desenvolvimento primeiro)
2. Testar a criação de pipeline com webhook
3. Se funcionar, aplicar em produção

## Alternativa Temporária (se não puder alterar o banco agora)

Modificar o código para **não salvar** o `stage_id` no webhook, deixando a configuração manual posterior:

```typescript
// Em useCreatePipeline.ts, linha 142
stage_id: null, // Temporariamente desabilitado até corrigir FK
```

Isso permite criar o pipeline, e o usuário pode configurar a etapa inicial depois via edição do webhook.
