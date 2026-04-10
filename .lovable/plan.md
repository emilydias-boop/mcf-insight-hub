

# Fix: Valores incorretos nas parcelas do billing sync

## Problema raiz

No sync Hubla (`sync-billing-from-hubla/index.ts`), linhas 124-126:
```
valorBruto = first.product_price  // 85 (correto por parcela)
valorLiquido = first.net_value    // 8021 (ERRADO - é o valor total do contrato, não por parcela)
valorTotal = valorBruto + (total - 1) * valorLiquido  // inflado
```

Para algumas assinaturas, a Hubla envia `net_value` da P1 como o valor total do contrato (ex: 8021), não o valor líquido por parcela (ex: 66.32). O sync usa esse valor para todas as parcelas não pagas, inflando `valor_original` e `valor_total_contrato`.

## Correção — 2 partes

### 1. Fix no sync (`supabase/functions/sync-billing-from-hubla/index.ts`)

Na seção de cálculo de valores (linhas ~124-126 e ~258-259), usar lógica mais inteligente para `valorLiquido`:

```typescript
// Tentar pegar net_value de uma P2+ (mais confiável)
const p2tx = txList.find(tx => (tx.installment_number || 1) > 1);
const valorLiquidoPerInstallment = p2tx 
  ? (p2tx.net_value || p2tx.product_price || 0)
  : (first.net_value && first.net_value <= first.product_price * 2 
      ? first.net_value 
      : first.product_price || 0);

const valorTotal = valorBruto + Math.max(totalInstallments - 1, 0) * valorLiquidoPerInstallment;
```

Mesma lógica na seção de criação de installments (linha ~258-259):
```typescript
const valorLiquido = valorLiquidoPerInstallment; // em vez de first.net_value
```

A heurística `net_value <= product_price * 2` protege contra o caso onde P1 `net_value` é o total do contrato.

### 2. Migration para corrigir dados existentes

SQL para recalcular `valor_original` das parcelas pendentes/atrasadas usando o valor correto de uma P2+ paga da mesma subscription:

```sql
-- Corrigir installments com valor_original inflado
WITH correct_values AS (
  SELECT DISTINCT ON (i.subscription_id)
    i.subscription_id,
    i.valor_original as correct_value
  FROM billing_installments i
  WHERE i.numero_parcela > 1
    AND i.status = 'pago'
    AND i.valor_pago > 0
  ORDER BY i.subscription_id, i.numero_parcela
)
UPDATE billing_installments bi
SET valor_original = cv.correct_value
FROM correct_values cv
WHERE bi.subscription_id = cv.subscription_id
  AND bi.numero_parcela > 1
  AND bi.status IN ('pendente', 'atrasado')
  AND bi.valor_original > cv.correct_value * 3;

-- Recalcular valor_total_contrato nas subscriptions afetadas
UPDATE billing_subscriptions bs
SET valor_total_contrato = sub_totals.total
FROM (
  SELECT subscription_id, SUM(valor_original) as total
  FROM billing_installments
  GROUP BY subscription_id
) sub_totals
WHERE bs.id = sub_totals.subscription_id
  AND ABS(bs.valor_total_contrato - sub_totals.total) > 100;
```

### Resultado esperado
- Nathália: parcelas 6-10 passam de R$ 8.021 para R$ 66.32, Valor Bruto correto ~R$ 681
- Todos os outros casos similares corrigidos automaticamente
- Novos syncs não reintroduzem o problema

