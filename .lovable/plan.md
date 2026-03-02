
## Diagnóstico

### Erro principal: `null value in column "clint_id" of relation "crm_contacts"`

A função `createContact` em `process-csv-imports/index.ts` tenta inserir contatos na tabela `crm_contacts`, mas essa tabela tem a coluna `clint_id` como **NOT NULL**. A função nunca passa o `clint_id`, então todos os contatos novos falham ao ser criados.

**Consequência**: contatos não são criados → deals ficam sem `contact_id` mas ainda são processados → importação "funciona" mas sem vínculo de contato.

### Problema secundário: Pipeline desatualizada no seletor

O seletor de "Pipeline de Destino" em `ImportarNegocios.tsx` busca **todas** as `crm_origins` (mais de 100). Deve filtrar apenas as origens da BU Incorporador via `bu_origin_mapping`, e pré-selecionar automaticamente "PIPELINE INSIDE SALES" (`e3c04f21-ba2c-4c66-84f8-b4341c826b1c`) que é o único `is_default: true`.

### Estado atual do mapeamento BU Incorporador
- `entity_type: group` → grupo "Perpétuo - X1" (`a6f3cbfc`) com 11 origens
- `entity_type: origin` → "PIPELINE INSIDE SALES" (`e3c04f21`) ← `is_default: true`

---

## Plano de correção

### 1. `supabase/functions/process-csv-imports/index.ts` — Corrigir `createContact`

A função `createContact` precisa gerar um `clint_id` sintético para contatos criados via importação CSV (já que eles não vêm da Clint). Usar um prefixo `csv_import_` + UUID aleatório:

```typescript
// ANTES (falha com NOT NULL constraint)
.insert({
  name: contactData.name,
  email: contactData.email || null,
  phone: normalizedPhone
})

// DEPOIS (gera clint_id sintético)
.insert({
  clint_id: `csv_import_${crypto.randomUUID()}`,
  name: contactData.name,
  email: contactData.email || null,
  phone: normalizedPhone
})
```

### 2. `src/pages/crm/ImportarNegocios.tsx` — Filtrar origens pela BU Incorporador

Substituir a query que busca **todas** as origens por uma query que:
1. Busca o mapeamento `bu_origin_mapping` onde `bu = 'incorporador'`
2. Expande grupos para incluir suas origens filhas
3. Inclui origens diretas (`entity_type = 'origin'`)
4. Pré-seleciona automaticamente a origin com `is_default = true` (`e3c04f21`)
5. Mostra apenas as origens relevantes no dropdown (11 do grupo + 1 direta = máx 12 itens)

Também adicionar seção expansível de **mapeamento de colunas** mostrando o que cada coluna CSV significa.

---

## Arquivos a modificar
- `supabase/functions/process-csv-imports/index.ts` — linha 430-449 (função `createContact`)
- `src/pages/crm/ImportarNegocios.tsx` — query de origens + auto-seleção + guia de colunas
