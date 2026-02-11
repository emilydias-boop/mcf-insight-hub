

## Problema Identificado

A requisição ao Supabase retorna erro **400: "column crm_stages_1.name does not exist"** porque o código está tentando buscar a coluna `name` na tabela `crm_stages`, quando na verdade a coluna correta é `stage_name`.

## Causa Raiz

Na função `useInsideSalesDeals()` (linha 35-37 em `src/hooks/useLimboLeads.ts`), o relacionamento está incorreto:

```typescript
crm_stages!crm_deals_stage_id_fkey (
  name  // ❌ ERRADO - não existe
)
```

Deveria ser:

```typescript
crm_stages (
  stage_name  // ✅ CORRETO
)
```

## Solução

**Remover completamente o relacionamento `crm_stages`** da query, pois:
1. O `stage_name` pode ser recuperado do Clint (coluna `excelStage` vindo da planilha)
2. Não é necessário buscar do banco para a comparação
3. Simplifica a query e evita o erro

Modificar a função `useInsideSalesDeals()` para:
- Remover linhas 35-37 (relacionamento `crm_stages`)
- Manter apenas: `id`, `name`, `value`, `owner_id`, `owner_profile_id`, `stage_id`, `origin_id`, `clint_id`, `created_at`, e `crm_contacts`

Isso permitirá que:
1. A query execute com sucesso (sem erro 400)
2. A comparação funcione corretamente usando os dados do Excel (stage/estagio da planilha)
3. A tabela de resultados mostre o estágio do Clint (excelStage) vs estágio local (que pode ser inferido depois se necessário)

