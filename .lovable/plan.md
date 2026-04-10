

# Fix: Valor Bruto usando net_value em vez de product_price

## Problema raiz

O sync usa `valorLiquidoPerInstallment` (que é o `net_value` da Hubla, valor APÓS taxas) como `valor_original` das parcelas P2+. Mas `valor_original` é o Bruto — deveria usar `product_price`.

Exemplo Guilherme (A000 - Contrato, 12 parcelas):
- Hubla P1: product_price=497, net_value=388.10
- Hoje no banco: P3-P12 `valor_original`=388.10 (net_value, ERRADO)
- Correto: P3-P12 `valor_original`=497 (product_price)
- Valor Bruto mostrado: R$4.378 (usando net). Correto: R$5.467

O mesmo problema afeta centenas de subscriptions.

## Correção — 2 partes

### 1. Fix no sync function

Adicionar `valorBrutoPerInstallment` separado do `valorLiquidoPerInstallment`:

```typescript
// Bruto per installment: usa product_price (não net_value)
const valorBrutoPerInstallment = p2tx
  ? (p2tx.product_price || first.product_price || 0)
  : (first.product_price || 0);

// Líquido per installment (mantém lógica atual)
const valorLiquidoPerInstallment = p2tx
  ? (p2tx.net_value || p2tx.product_price || 0)
  : (first.net_value && first.net_value <= (first.product_price || 0) * 2
      ? first.net_value : first.product_price || 0);

// valor_total usa BRUTO
const valorTotal = valorBruto + Math.max(totalInstallments - 1, 0) * valorBrutoPerInstallment;
```

Nas linhas de criação de installments (325, 352):
```typescript
valor_original: i === 1 ? valorBruto : valorBrutoPerInstallment,  // BRUTO
valor_liquido: i === 1 ? valorLiquido : valorLiquidoInst,         // LÍQUIDO
```

### 2. Migration para corrigir dados existentes

Dois passos SQL:

**Passo A**: Corrigir installments pagos que têm `hubla_transaction_id` — usar `product_price` da transação:
```sql
UPDATE billing_installments bi
SET valor_original = ht.product_price
FROM hubla_transactions ht
WHERE bi.hubla_transaction_id = ht.id
  AND bi.numero_parcela > 1
  AND bi.valor_original != ht.product_price;
```

**Passo B**: Corrigir installments pendentes/atrasados sem transação — usar `product_price` de um P2+ pago da mesma subscription:
```sql
WITH ref AS (
  SELECT DISTINCT ON (bi.subscription_id)
    bi.subscription_id, ht.product_price as correct_bruto
  FROM billing_installments bi
  JOIN hubla_transactions ht ON ht.id = bi.hubla_transaction_id
  WHERE bi.numero_parcela > 1
  ORDER BY bi.subscription_id, bi.numero_parcela
)
UPDATE billing_installments bi
SET valor_original = r.correct_bruto
FROM ref r
WHERE bi.subscription_id = r.subscription_id
  AND bi.numero_parcela > 1
  AND bi.status IN ('pendente', 'atrasado');
```

**Passo C**: Recalcular `valor_total_contrato` das subscriptions:
```sql
UPDATE billing_subscriptions bs
SET valor_total_contrato = sub_totals.total
FROM (
  SELECT subscription_id, SUM(valor_original) as total
  FROM billing_installments
  GROUP BY subscription_id
) sub_totals
WHERE bs.id = sub_totals.subscription_id
  AND bs.valor_total_contrato != sub_totals.total;
```

### Resultado esperado
- Guilherme: parcelas P3-P12 passam de R$388.10 para R$497, Bruto corrigido
- Todos os demais com o mesmo padrão corrigidos
- Novos syncs usam product_price para bruto

