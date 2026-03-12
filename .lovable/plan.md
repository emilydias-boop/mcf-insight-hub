

## Problema: Filtro de período só mostra 2 meses

O `Select` nas linhas 354-366 do `src/pages/bu-consorcio/Index.tsx` está hardcoded com apenas 2 opções: mês atual e mês anterior.

### Correção

Substituir as 2 `SelectItem` fixas por uma lista dinâmica dos últimos **12 meses**, gerada com `subMonths`. O `period` state mudará de `'month' | 'lastMonth' | 'custom'` para armazenar o índice do mês (ex: `"0"` = mês atual, `"1"` = mês anterior, etc.), e o cálculo de `startDate`/`endDate` será atualizado para usar esse índice.

### Mudanças

**Arquivo: `src/pages/bu-consorcio/Index.tsx`**

1. Gerar array de 12 meses:
```typescript
const monthOptions = Array.from({ length: 12 }, (_, i) => {
  const date = subMonths(now, i);
  return {
    value: String(i),
    label: format(date, 'MMMM yyyy', { locale: ptBR }),
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
});
```

2. Mudar state de `period` para `monthOffset` (string `"0"` a `"11"`), default `"0"`.

3. Calcular `startDate`/`endDate` a partir do offset selecionado.

4. Renderizar os 12 meses no `SelectContent`.

