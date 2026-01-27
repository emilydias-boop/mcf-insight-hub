
# Plano: Corrigir Query do Relatório de Qualificação R2

## Problema Identificado

A query no hook `useR2QualificationReport.ts` está retornando **erro 400** porque está usando uma foreign key que não existe:

```
owner:profiles!crm_deals_owner_id_fkey(id, full_name)
```

**Erro retornado pelo Supabase:**
> "Could not find a relationship between 'crm_deals' and 'profiles' using the hint 'crm_deals_owner_id_fkey'"

## Causa Raiz

A tabela `crm_deals` não possui `owner_id` como FK para `profiles`. A coluna correta é:

| Errado (atual) | Correto |
|----------------|---------|
| `owner_id` | `owner_profile_id` |
| `crm_deals_owner_id_fkey` | `crm_deals_owner_profile_id_fkey` |

## Solução

Corrigir a query na linha 72 do arquivo `src/hooks/useR2QualificationReport.ts`:

**Antes (com erro):**
```typescript
deal:crm_deals(
  id,
  name,
  owner_id,
  custom_fields,
  contact:crm_contacts(name, email, phone),
  owner:profiles!crm_deals_owner_id_fkey(id, full_name)  // ← FK errada
)
```

**Depois (corrigido):**
```typescript
deal:crm_deals(
  id,
  name,
  owner_profile_id,
  custom_fields,
  contact:crm_contacts(name, email, phone),
  owner:profiles!crm_deals_owner_profile_id_fkey(id, full_name)  // ← FK correta
)
```

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useR2QualificationReport.ts` | Corrigir linha 69 (`owner_id` → `owner_profile_id`) e linha 72 (FK correta) |

## Resultado Esperado

1. Query executará com sucesso (status 200)
2. Dados de qualificação R2 aparecerão nos gráficos e tabela
3. Total de leads, realizadas, no-shows e taxa de conversão exibirão valores corretos
4. Exportação Excel funcionará com dados populados
