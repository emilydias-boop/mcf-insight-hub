
# Corrigir Cálculo de Faturamento Bruto no Relatório de Vendas

## Problema Identificado

O componente `SalesReportPanel.tsx` (usado na página de Relatórios do Incorporador) calcula o faturamento bruto de forma diferente das outras partes do sistema:

| Componente | Fórmula | Janeiro 2026 |
|------------|---------|--------------|
| Relatórios (atual) | `sum(gross_override \|\| product_price)` | R$ 2.889.358 |
| Transações | `sum(getDeduplicatedGross())` | ~R$ 2.000.000 |
| Fechamento (Edge Function) | `sum(getDeduplicatedGross())` | ~R$ 2.000.000 |

### Diferença de ~R$ 889.358 causada por:

1. **Transações duplicadas** - mesmo cliente comprando mesmo produto é contado várias vezes
2. **Parcelas > 1** - parcelas subsequentes são somadas (deveriam ser zero)
3. **Preços não-fixos** - usa `product_price` real ao invés dos configurados:
   - A009 deveria ser R$ 19.500, não R$ 1.000
   - A001 deveria ser R$ 14.500, não R$ 4.184

## Código Problemático

**Arquivo: `src/components/relatorios/SalesReportPanel.tsx`**

Linha 220:
```javascript
const totalGross = filteredTransactions.reduce(
  (sum, t) => sum + (t.gross_override || t.product_price || 0), 
  0
);
```

## Solução

Atualizar o `SalesReportPanel` para usar a mesma lógica de deduplicação do `TransacoesIncorp`:

### Alterações Necessárias

#### 1. Adicionar query para buscar IDs de primeira transação

```javascript
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';

// Buscar IDs de primeira compra GLOBAL via RPC
const { data: globalFirstIds = new Set<string>() } = useQuery({
  queryKey: ['global-first-transaction-ids'],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('get_first_transaction_ids');
    if (error) throw error;
    return new Set((data || []).map((r: { id: string }) => r.id));
  },
  staleTime: 1000 * 60 * 5, // 5 minutos
});
```

#### 2. Atualizar cálculo dos stats (linha 219-226)

De:
```javascript
const stats = useMemo(() => {
  const totalGross = filteredTransactions.reduce(
    (sum, t) => sum + (t.gross_override || t.product_price || 0), 
    0
  );
  // ...
}, [filteredTransactions]);
```

Para:
```javascript
const stats = useMemo(() => {
  const totalGross = filteredTransactions.reduce((sum, t) => {
    const isFirst = globalFirstIds.has(t.id);
    return sum + getDeduplicatedGross(t, isFirst);
  }, 0);
  // ...
}, [filteredTransactions, globalFirstIds]);
```

#### 3. Atualizar export Excel (linha 238)

De:
```javascript
'Valor Bruto': row.gross_override || row.product_price || 0,
```

Para:
```javascript
'Valor Bruto': getDeduplicatedGross(row, globalFirstIds.has(row.id)),
```

## Resultado Esperado

Após a correção:

| Componente | Faturamento Janeiro 2026 |
|------------|--------------------------|
| Relatórios | ~R$ 2.000.000 |
| Transações | ~R$ 2.000.000 |
| Fechamento | ~R$ 2.000.000 |

Todos os componentes mostrarão valores consistentes.

## Arquivos a Modificar

1. **`src/components/relatorios/SalesReportPanel.tsx`**:
   - Adicionar import de `getDeduplicatedGross`
   - Adicionar query para `get_first_transaction_ids`
   - Atualizar cálculo de `totalGross` nos stats
   - Atualizar valor bruto no export Excel

## Observação

A discrepância **NÃO é causada por reembolsos** - as transações com status `refunded` já estão incluídas em ambos os cálculos. A diferença é puramente pela falta de:
- Deduplicação por cliente+produto
- Aplicação dos preços fixos configurados
- Zeragem de parcelas > 1
