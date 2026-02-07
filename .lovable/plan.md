
# Corrigir Faturamento de Janeiro no Relatorio Incorporador

## Problema Identificado

O relatorio de vendas esta usando valores incorretos para calcular o faturamento bruto. A analise revelou:

| Calculo | Valor Janeiro |
|---------|---------------|
| Usando `product_price` (errado) | R$ 899.525 |
| Usando `reference_price` (correto) | R$ 953.622 |
| Diferenca | R$ 54.096 |

### Causa Raiz

O componente `SalesReportPanel` usa a funcao `getDeduplicatedGross()` que depende do cache de precos (`getCachedFixedGrossPrice`). Porem:

1. O RPC `get_hubla_transactions_by_bu` NAO retorna o `reference_price` da tabela `product_configurations`
2. Quando o cache falha em encontrar o produto por pattern matching, a funcao usa `product_price` como fallback
3. O `product_price` representa o valor PAGO pelo cliente (com descontos, promocoes), nao o preco de tabela

Exemplo do problema:
- A001 - MCF Incorporador Completo: `reference_price` = R$ 14.500
- Mas clientes pagaram valores como R$ 5.000, R$ 17.577, R$ 21.000, R$ 29.000
- Isso causa calculos inconsistentes

## Solucao Proposta

### 1. Atualizar RPC para retornar reference_price

Modificar a funcao `get_hubla_transactions_by_bu` para incluir o preco de referencia:

```text
ANTES:
  SELECT ht.id, ht.product_name, ht.product_price, ...
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name

DEPOIS:
  SELECT ht.id, ht.product_name, ht.product_price, 
         pc.reference_price,  -- NOVO CAMPO
         ...
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
```

### 2. Atualizar Interface TypeScript

Adicionar campo no tipo `HublaTransaction`:

```typescript
// src/hooks/useAllHublaTransactions.ts
export interface HublaTransaction {
  // ... campos existentes
  reference_price?: number | null;  // NOVO
}
```

### 3. Atualizar Logica de Calculo no SalesReportPanel

Modificar o calculo do bruto para usar `reference_price` diretamente quando disponivel:

```typescript
// src/components/relatorios/SalesReportPanel.tsx
const stats = useMemo(() => {
  const totalGross = filteredTransactions.reduce((sum, t) => {
    const isFirst = globalFirstIds.has(t.id);
    // Usar reference_price do banco quando disponivel
    const refPrice = t.reference_price ?? getDeduplicatedGross(t, isFirst);
    return sum + (isFirst ? refPrice : 0);
  }, 0);
  // ...
}, [filteredTransactions, globalFirstIds]);
```

### 4. Adicionar Coluna de Validacao na Tabela (Opcional)

Para facilitar debugging, adicionar coluna mostrando valor de referencia:

```typescript
<TableCell className="text-right">
  {formatCurrency(getDeduplicatedGross(row, globalFirstIds.has(row.id)))}
  {row.reference_price && row.reference_price !== row.product_price && (
    <span className="text-xs text-muted-foreground ml-1">
      (ref: {formatCurrency(row.reference_price)})
    </span>
  )}
</TableCell>
```

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Migration SQL | Atualizar RPC `get_hubla_transactions_by_bu` |
| `src/hooks/useTransactionsByBU.ts` | Atualizar tipo de retorno |
| `src/hooks/useAllHublaTransactions.ts` | Adicionar `reference_price` na interface |
| `src/components/relatorios/SalesReportPanel.tsx` | Usar `reference_price` no calculo |

## Resultado Esperado

Apos a correcao, Janeiro 2025 devera mostrar:
- Faturamento Bruto: ~R$ 953.622
- Baseado em 300 transacoes primarias (primeira compra por cliente+produto)
- Usando precos fixos da tabela `product_configurations`

## Detalhes Tecnicos

### Distribuicao por Produto (Janeiro 2025)

| Produto | Qtd | Bruto Esperado |
|---------|-----|----------------|
| A001 | 32 | R$ 464.000 |
| A009 | 7 | R$ 136.500 |
| A003 | 16 | R$ 120.000 |
| A000 | ~177 | R$ 88.481 |
| A004 | 10 | R$ 55.000 |
| A002 | 3 | R$ 43.500 |
| A006 | 43 | R$ 43.000 |
| A008 | 2 | R$ 3.000 |
| A010 | 3 | R$ 141 |
| A005 | 18 | R$ 0 (upgrades) |
| **Total** | **300** | **R$ 953.622** |

### Logica de Deduplicacao

A deduplicacao continua funcionando:
1. Parcela > 1 = bruto zerado
2. `gross_override` tem prioridade (correcoes manuais)
3. Nao e primeira transacao do cliente+produto = bruto zerado
4. Usar `reference_price` da tabela (nao `product_price`)
