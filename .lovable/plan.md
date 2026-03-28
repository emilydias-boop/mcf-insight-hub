

## Corrigir valor bruto da Parceria usando lógica de preço de referência

### Problema

A query de parcerias (linha 422) busca apenas `product_price` e `net_value`. O `product_price` no `hubla_transactions` pode ser o valor da parcela (não o bruto total). O correto é usar a mesma lógica de `getDeduplicatedGross()` que considera `reference_price`, `gross_override` e `installment_number`.

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`**:

1. **Expandir select da query de parcerias** (linha 422): adicionar `reference_price, gross_override, installment_number, id`
```typescript
.select('id, customer_email, sale_date, product_name, product_price, net_value, reference_price, gross_override, installment_number')
```

2. **Calcular bruto correto no parceriaMap** (linhas 450-454): usar `getDeduplicatedGross()` (importado de `incorporadorPricing`) em vez de `product_price` direto
```typescript
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';

// Ao montar o map:
const grossValue = getDeduplicatedGross({
  product_name: p.product_name,
  product_price: p.product_price,
  installment_number: p.installment_number,
  gross_override: p.gross_override,
  reference_price: p.reference_price,
}, true); // isFirstOfGroup = true pois pegamos 1 por email
```

### Arquivo alterado
- `src/hooks/useCarrinhoAnalysisReport.ts` (2 pontos: query select + cálculo do grossValue)

