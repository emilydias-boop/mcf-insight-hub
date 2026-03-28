

## Fix: Valor bruto da parceria usando `reference_price` do banco

### Problema

A query de parcerias (linha 422) **não busca `reference_price`** da tabela `hubla_transactions`. A função `getDeduplicatedGross()` então cai no fallback hardcoded (`getFixedGrossPrice`), que pode retornar valores desatualizados ou incorretos — ignorando o que foi configurado na aba Produtos.

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`** — 2 pontos:

1. **Expandir select** (linha 423): adicionar `reference_price`
```typescript
.select('id, customer_email, sale_date, product_name, product_price, net_value, gross_override, installment_number, reference_price')
```

2. **Passar `reference_price` para `getDeduplicatedGross`** (linhas 455-460):
```typescript
const grossValue = getDeduplicatedGross({
  product_name: p.product_name,
  product_price: p.product_price,
  installment_number: p.installment_number,
  gross_override: p.gross_override,
  reference_price: p.reference_price,  // ← ADICIONADO
}, true);
```

Isso faz a Regra 5 (`reference_price`) ser aplicada antes do fallback hardcoded (Regra 6), respeitando o valor configurado na aba Produtos.

### Arquivo alterado
- `src/hooks/useCarrinhoAnalysisReport.ts` (2 pontos)

