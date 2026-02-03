

# Plano: Corrigir Duplicação de Leads A010

## Problema Identificado

Os leads A010 entram pelo webhook da Hubla e estão sendo duplicados devido a uma **race condition**. A Hubla envia múltiplos webhooks simultaneamente para a mesma compra.

## Solução em 3 Etapas

### Etapa 1: Adicionar Constraint Única no Banco

Criar um índice único parcial para prevenir duplicados a nível de banco:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS crm_deals_contact_origin_unique 
ON crm_deals (contact_id, origin_id) 
WHERE contact_id IS NOT NULL 
  AND origin_id IS NOT NULL 
  AND data_source = 'webhook';
```

### Etapa 2: Modificar hubla-webhook-handler para Usar Upsert

Alterar a função `createOrUpdateCRMContact` em `hubla-webhook-handler/index.ts` para usar `upsert` atômico ao invés de SELECT + INSERT.

### Etapa 3: Limpar Duplicados Existentes (Lógica Atualizada)

**Regras de limpeza:**
1. Se o deal **tem atividades** (foi mexido) → **MANTER**
2. Se o deal **não tem atividades** E existem outros duplicados com atividades → **DELETAR**
3. Se **nenhum duplicado tem atividades** → manter apenas o **mais antigo**

```sql
-- Identificar deals duplicados para deletar
WITH duplicated_contacts AS (
  SELECT 
    d.contact_id,
    d.origin_id
  FROM crm_deals d
  WHERE d.data_source = 'webhook'
    AND d.name ILIKE '%A010%'
    AND d.contact_id IS NOT NULL
  GROUP BY d.contact_id, d.origin_id
  HAVING COUNT(*) > 1
),
deal_analysis AS (
  SELECT 
    d.id as deal_id,
    d.contact_id,
    d.origin_id,
    d.created_at,
    (SELECT COUNT(*) FROM deal_activities da WHERE da.deal_id = d.id::text) as activity_count,
    ROW_NUMBER() OVER (
      PARTITION BY d.contact_id, d.origin_id 
      ORDER BY d.created_at ASC
    ) as rn
  FROM crm_deals d
  JOIN duplicated_contacts dc 
    ON d.contact_id = dc.contact_id 
    AND d.origin_id = dc.origin_id
),
group_has_activities AS (
  SELECT 
    contact_id,
    origin_id,
    SUM(activity_count) as total_activities
  FROM deal_analysis
  GROUP BY contact_id, origin_id
),
deals_to_delete AS (
  SELECT da.deal_id
  FROM deal_analysis da
  JOIN group_has_activities gha 
    ON da.contact_id = gha.contact_id 
    AND da.origin_id = gha.origin_id
  WHERE 
    -- Caso 1: Grupo tem deals com atividades → deletar os SEM atividades
    (gha.total_activities > 0 AND da.activity_count = 0)
    OR
    -- Caso 2: Grupo NÃO tem nenhuma atividade → deletar todos exceto o mais antigo
    (gha.total_activities = 0 AND da.rn > 1)
)
DELETE FROM crm_deals 
WHERE id IN (SELECT deal_id FROM deals_to_delete);
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar índice único `crm_deals_contact_origin_unique` |
| `supabase/functions/hubla-webhook-handler/index.ts` | Substituir SELECT+INSERT por UPSERT na função `createOrUpdateCRMContact` |

## Resultado Esperado

| Cenário | Ação |
|---------|------|
| Deal com atividades | MANTER (mesmo se duplicado) |
| Deal sem atividades + outro com atividades | DELETAR |
| Todos sem atividades | Manter mais antigo, deletar outros |
| Novos webhooks simultâneos | Constraint previne duplicação |

