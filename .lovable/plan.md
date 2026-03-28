

## Fix: Wilmar e outros leads com A010 aparecem sem Canal

### Causa raiz

O Wilmar tem compras A010 visíveis na timeline do CRM, mas o Canal aparece como "—". Dois problemas possíveis:

1. **A010 query filtra apenas por `product_category = 'a010'`** (linha 223). Se a transação A010 do lead tiver uma `product_category` diferente (ex: `incorporador`, `null`), o `a010Map` fica vazio para esse email, e o fallback `HUBLA (A010)` nunca dispara.

2. **Deal pode não estar sendo encontrado** para o contato (SDR e Class. também mostram "—"), o que elimina tags como fonte de canal. Mas mesmo sem deal, se `a010Date` fosse populado, o fallback da linha 607 funcionaria.

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`** — Expandir a query de A010 para também buscar por `product_name`:

```typescript
// Atual (linha 221-225):
.in('product_category', ['a010'])

// Corrigir para:
.or('product_category.eq.a010,product_name.ilike.%a010%')
```

Isso garante que compras A010 sejam detectadas mesmo quando a `product_category` não está preenchida como `'a010'`.

### Arquivos alterados
- `src/hooks/useCarrinhoAnalysisReport.ts` (uma linha na query de A010)

