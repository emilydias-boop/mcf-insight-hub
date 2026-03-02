
## Diagnóstico

Na linha 486-491 de `process-csv-imports/index.ts`:

```typescript
const clintId = csvDeal.id?.trim()
const name = csvDeal.name?.trim()

if (!clintId || !name) {
  return null  // ← deals da Hubla sem coluna 'id' caem aqui e são descartados
}
```

CSVs exportados da Hubla não têm uma coluna `id` — por isso 324 deals foram silenciosamente ignorados. A solução correta é **gerar um `clint_id` sintético** quando a coluna `id` está ausente (igual ao que já é feito para contatos com prefixo `csv_import_`).

O `clint_id` sintético deve ser determinístico (baseado no nome + email + created_at do CSV) para evitar duplicatas se o usuário reimportar o mesmo arquivo.

---

## O que mudar

### `supabase/functions/process-csv-imports/index.ts`

**`convertToDBFormat`** → em vez de retornar `null` quando `!clintId`, gerar um ID sintético baseado em hash do conteúdo:

```typescript
// ANTES
const clintId = csvDeal.id?.trim()
if (!clintId || !name) return null

// DEPOIS
const clintId = csvDeal.id?.trim() || generateSyntheticId(csvDeal)
if (!name) return null  // só bloquear se não tiver nome
```

**Função `generateSyntheticId`** (nova, no mesmo arquivo):
```typescript
function generateSyntheticId(csvDeal: CSVDeal): string {
  // Hash determinístico baseado em campos únicos do deal
  const seed = [
    csvDeal.name?.trim() || '',
    csvDeal.email?.trim() || '',
    csvDeal.phone?.trim() || csvDeal.telefone?.trim() || '',
    csvDeal.created_at?.trim() || '',
  ].join('|').toLowerCase()
  
  // Simples hash numérico para Deno (sem btoa de objetos)
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  return `csv_import_${Math.abs(hash)}`
}
```

Isso garante que:
- Deals sem coluna `id` (Hubla, etc.) **não serão mais descartados**
- Reimportações do mesmo CSV **não criam duplicatas** (mesmo hash → mesmo `clint_id` → upsert)
- Deals com `id` explícito continuam funcionando normalmente

### `src/pages/crm/ImportarNegocios.tsx`

Adicionar nota informativa no card de deals ignorados quando `total_skipped > 0` mas `errors.length === 0`, explicando que leads sem coluna `id` agora são processados com ID sintético. Se ainda houver ignorados, mostrar o botão de download.

---

## Arquivos a modificar
- `supabase/functions/process-csv-imports/index.ts` — `convertToDBFormat` gera ID sintético + nova função `generateSyntheticId`
- Re-deploy da edge function `process-csv-imports`
