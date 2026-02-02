
# Plano: Resolver Problemas da Pipeline "Efeito Alavanca + Clube"

## Diagnóstico Confirmado

### Problema 1: Deal criado via webhook não aparece no Kanban
- O deal `907e22e8-d704-46c3-94b8-847000cec6d7` foi criado com `stage_id: null`
- Isso acontece porque existe uma **FK constraint** em `crm_deals.stage_id` que referencia `crm_stages`
- As stages de "Efeito Alavanca + Clube" existem apenas em `local_pipeline_stages`
- O Kanban filtra deals por `deal.stage_id === stage.id`, então deals sem stage_id não aparecem

### Problema 2: Importação dos 3.693 negócios do CSV
- A função `process-csv-imports` só busca stages em `crm_stages` (linhas 375-389)
- Não consulta `local_pipeline_stages`, então não conseguirá mapear stages como "VENDA REALIZADA 50K"

### Stages do CSV (coluna "stage")
Identificadas no CSV:
- `VENDA REALIZADA 50K` (maioria dos registros)
- `RESGATE CARRINHO 50K`
- Outros que serão identificados na migração

### Stages configuradas em local_pipeline_stages
13 stages criadas para origin_id `7d7b1cb5-2a44-4552-9eff-c3b798646b78`:
1. NOVO LEAD ( FORM )
2. CLUBE DO ARREMATE
3. RENOVAÇÃO HUBLA
4. RESGATE CARRINHO 50K
5. VENDA REALIZADA 50K
6. EVENTOS
7. R1 Agendada
8. NO-SHOW
9. R1 Realizada
10. AGUARDANDO DOC
11. CARTA SOCIOS FECHADA
12. APORTE HOLDING
13. CARTA + APORTE

---

## Solução em 3 Partes

### Parte 1: Migração de Schema - Permitir stages de local_pipeline_stages
Criar uma migração SQL que:
1. Espelhe as stages de `local_pipeline_stages` para `crm_stages` (com mesmo ID)
2. Isso permite que a FK continue válida enquanto usamos stages customizadas

**Nova migration SQL:**
```sql
-- Espelhar stages de "Efeito Alavanca + Clube" para crm_stages
INSERT INTO crm_stages (id, clint_id, stage_name, color, origin_id, stage_order, is_active)
SELECT 
  id,
  'local-' || id::text as clint_id,
  name as stage_name,
  color,
  origin_id,
  stage_order,
  is_active
FROM local_pipeline_stages
WHERE origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
ON CONFLICT (id) DO UPDATE SET
  stage_name = EXCLUDED.stage_name,
  color = EXCLUDED.color,
  stage_order = EXCLUDED.stage_order,
  is_active = EXCLUDED.is_active;
```

### Parte 2: Corrigir o deal existente
Atualizar o deal criado via webhook para apontar para a primeira stage:
```sql
UPDATE crm_deals
SET stage_id = 'b5af7d28-7a0f-4da5-a115-094489fbc07d'  -- ID de "NOVO LEAD ( FORM )"
WHERE id = '907e22e8-d704-46c3-94b8-847000cec6d7';
```

### Parte 3: Importação do CSV
Duas abordagens possíveis:

**Opção A (Recomendada): Edge Function dedicada**
Criar/atualizar a função `process-csv-imports` para:
1. Buscar stages em `local_pipeline_stages` primeiro, depois `crm_stages` como fallback
2. Mapear nome da stage para ID correto
3. Criar contatos automaticamente se não existirem

**Opção B: Importação via SQL direto**
Rodar script SQL que:
1. Lê o CSV da tabela de upload
2. Cria contatos e deals com stage_id mapeado

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migration SQL | Espelhar stages de local_pipeline_stages para crm_stages |
| `supabase/functions/webhook-lead-receiver/index.ts` | Buscar stage em local_pipeline_stages e usar o ID espelhado em crm_stages |
| `supabase/functions/process-csv-imports/index.ts` | Adicionar busca em local_pipeline_stages no loadStagesCache |

---

## Mudanças na Edge Function process-csv-imports

### Função `loadStagesCache` atualizada:
```typescript
async function loadStagesCache(supabase: any): Promise<Map<string, string>> {
  const cache = new Map<string, string>()
  
  // 1. Buscar de local_pipeline_stages primeiro (prioridade)
  const { data: localStages } = await supabase
    .from('local_pipeline_stages')
    .select('id, name')
    .eq('is_active', true)
  
  if (localStages) {
    for (const stage of localStages) {
      cache.set(stage.name.toLowerCase().trim(), stage.id)
    }
  }
  
  // 2. Fallback para crm_stages (stages legadas)
  const { data: crmStages } = await supabase
    .from('crm_stages')
    .select('id, stage_name')
  
  if (crmStages) {
    for (const stage of crmStages) {
      // Só adiciona se não existir no cache (local tem prioridade)
      if (!cache.has(stage.stage_name.toLowerCase().trim())) {
        cache.set(stage.stage_name.toLowerCase().trim(), stage.id)
      }
    }
  }
  
  console.log(`✅ Cache de estágios: ${cache.size} entradas`)
  return cache
}
```

---

## Resultado Esperado

1. O deal criado via webhook aparecerá na coluna "NOVO LEAD ( FORM )"
2. A importação do CSV conseguirá mapear as 3.693 linhas para as stages corretas
3. Futuros leads via webhook serão atribuídos à stage correta

---

## Validação

Após implementação:
1. Verificar que o deal `907e22e8...` aparece no Kanban
2. Testar novo envio via webhook e confirmar que aparece na coluna correta
3. Executar importação do CSV e verificar contagem de deals por stage
