
# Correção: Pipelines não aparecem no seletor de Regras de Replicação

## Problema Identificado

O seletor de "Pipeline" no modal de criação de regras está vazio porque a query está usando uma coluna inexistente.

**Causa:** A tabela `crm_origins` usa `is_archived` (boolean inverso), mas o código está filtrando por `is_active` que não existe.

## Correção Necessária

**Arquivo:** `src/components/crm/automations/ReplicationRulesEditor.tsx`

**Linha 67 (atual):**
```typescript
const result = await supabase.from('crm_origins').select('id, name').eq('is_active', true).order('name');
```

**Corrigir para:**
```typescript
const result = await supabase.from('crm_origins').select('id, name').eq('is_archived', false).order('name');
```

## Resumo da Mudança

| Componente | Antes | Depois |
|------------|-------|--------|
| Query de origins | `.eq('is_active', true)` | `.eq('is_archived', false)` |
| Efeito | Lista vazia | Lista com todas as pipelines ativas |

## Validação

A tabela `crm_stages` está correta (usa `is_active`), então não precisa de alteração.
