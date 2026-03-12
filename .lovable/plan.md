

## Fix: Coluna Bruto na tabela de Transações não usa deduplicação

### Problema
A coluna "Bruto" na tabela de transações (linha 1150) mostra o valor bruto cru (`row.gross_override || row.product_price || 0`) sem aplicar a lógica de deduplicação `getDeduplicatedGross()`. Os KPIs usam a deduplicação corretamente, mas a tabela não acompanhou.

Resultado: Andre Luciano de Souza aparece com R$ 3.000 e R$ 16.500 quando deveria mostrar o valor deduplificado (ex: R$ 0 na duplicata).

### Solução

**Arquivo: `src/components/relatorios/SalesReportPanel.tsx`**

1. **Na renderização da coluna Bruto** (linha ~1150), substituir:
```tsx
{formatCurrency(row.gross_override || row.product_price || 0)}
```
por:
```tsx
{(() => {
  const grossVal = shouldUseBUFilter
    ? (row.product_price || row.net_value || 0)
    : getDeduplicatedGross(row, globalFirstIds.has(row.id));
  const rawVal = row.gross_override || row.product_price || 0;
  const isDeduplicated = grossVal === 0 && rawVal > 0;
  return isDeduplicated 
    ? <span className="text-muted-foreground line-through">{formatCurrency(rawVal)}</span>
    : formatCurrency(grossVal);
})()}
```

Isso aplica a mesma lógica de deduplicação dos KPIs na coluna Bruto, mostrando o valor com strikethrough quando foi zerado por deduplicação (parcela duplicada do mesmo cliente+produto).

