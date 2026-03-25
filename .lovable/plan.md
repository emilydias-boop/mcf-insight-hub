

## Fix: Aspas nos nomes/telefones + duplicação na importação

### Problema
Ao importar planilha CSV, os valores vêm com aspas literais (ex: `"Wallyson Diego"` em vez de `Wallyson Diego`). Isso causa:
1. Nomes e telefones salvos com aspas no CRM
2. Duplicação de contatos — a busca por nome/email/telefone não encontra o contato existente (sem aspas), criando um novo

### Causa raiz
A função `parseTextToRows` em `SpreadsheetCompareDialog.tsx` (linha 113) faz `line.split(sep).map(p => p.trim())` mas **não remove aspas** dos valores CSV. Valores como `"nome"` ficam com as aspas literais.

### Solução

**1. Client-side — `SpreadsheetCompareDialog.tsx`**

Adicionar função `stripQuotes` e aplicar ao parser de texto (linha 113):

```typescript
function stripQuotes(val: string): string {
  const trimmed = val.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}
```

Aplicar em `parseTextToRows` na construção dos rows (linha 112-119):
```typescript
const rawData = dataLines.map(line => {
  const parts = line.split(sep).map(p => stripQuotes(p));
  // ...
});
```

E também no `handleCompare` (linhas 302-305) ao construir os rows:
```typescript
return {
  name: String(row[columnMapping.name] || '').replace(/^["']|["']$/g, '').trim(),
  email: String(row[columnMapping.email] || '').replace(/^["']|["']$/g, '').trim(),
  phone: String(row[columnMapping.phone] || '').replace(/^["']|["']$/g, '').trim(),
  extraColumns,
};
```

**2. Server-side — `import-spreadsheet-leads/index.ts`**

Sanitizar name e phone no início do loop (após linha 71):
```typescript
const cleanName = (lead.name || '').replace(/^["']|["']$/g, '').trim();
const cleanPhone = (lead.phone || '').replace(/^["']|["']$/g, '').trim();
```

Usar `cleanName` e `cleanPhone` em vez de `lead.name` e `lead.phone` em todos os usos subsequentes (insert de contato, insert de deal, etc).

### Arquivos alterados
- `src/components/crm/SpreadsheetCompareDialog.tsx` — strip quotes no parser CSV e no handleCompare
- `supabase/functions/import-spreadsheet-leads/index.ts` — sanitização server-side como safety net

