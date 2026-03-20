

## Plano: Corrigir parser client-side para duplicatas de header

### Causa raiz

O parser server-side (`process-csv-imports`) já foi corrigido para lidar com headers duplicados, mas a **UI de importação** (`SpreadsheetCompareDialog.tsx`) tem o mesmo bug:

Na função `parseTextToRows` (linha 90), headers duplicados como `Cliente, Cliente` geram um array `['Cliente', 'Cliente']`. Quando os dados são montados em objeto (linha 107-108), o segundo valor sobrescreve o primeiro — o nome real do consorciado (coluna 1) é substituído pelo nome do SDR (coluna 2).

No dropdown de mapeamento, ambos aparecem como "Cliente" (ou concatenados como "ClienteCliente"), sem distinção.

### Alterações

| Arquivo | O que muda |
|---------|-----------|
| `src/components/crm/SpreadsheetCompareDialog.tsx` | (1) Renomear headers duplicados em `parseTextToRows` (ex: `Cliente` → `Cliente`, `Cliente_2`). (2) Atualizar `autoMapColumns` para priorizar o primeiro `cliente` como nome. (3) Garantir que o mesmo fix se aplica ao path XLSX (sheet_to_json já gera keys únicas, mas validar). |

### Detalhes

**1. Renomear duplicatas em `parseTextToRows`** (linha ~90):
```typescript
// Antes:
headers = firstLine.split(sep).map(h => h.trim());

// Depois:
const rawHeaders = firstLine.split(sep).map(h => h.trim());
const seen = new Map<string, number>();
headers = rawHeaders.map(h => {
  const key = h.toLowerCase();
  const count = (seen.get(key) || 0) + 1;
  seen.set(key, count);
  return count > 1 ? `${h}_${count}` : h;
});
```

Resultado: `['Cliente', 'Cliente']` → `['Cliente', 'Cliente_2']`

**2. Atualizar `autoMapColumns`** — o hint `'cliente'` já existe para `name`. Como agora o primeiro `Cliente` mantém o nome original e o segundo vira `Cliente_2`, o auto-map vai pegar corretamente o primeiro (nome do consorciado).

**3. Path XLSX** — `XLSX.utils.sheet_to_json` já renomeia duplicatas automaticamente (`Cliente`, `Cliente_1`), mas o `Object.keys()` na linha 214 pode gerar nomes diferentes. Adicionar o mesmo tratamento de duplicatas para consistência.

**4. Espelhar no `LeadsLimbo.tsx`** — a mesma função `parseTextToRows` do LeadsLimbo (se existir) precisa do mesmo fix.

Isso garante que ao mapear "Nome" → "Cliente", o valor correto (nome do consorciado, não o SDR) será usado.

