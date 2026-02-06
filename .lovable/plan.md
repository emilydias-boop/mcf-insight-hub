
# Sincronizar Cálculo de Faturamento com Preços Fixos na Edge Function

## Problema Identificado

A Edge Function `recalculate-sdr-payout` calcula o faturamento da BU Incorporador usando apenas `product_price`, mas o frontend usa **preços fixos por produto** definidos em `incorporadorPricing.ts`.

| Metodo | Faturamento Janeiro 2026 | Ultrameta Batida? |
|--------|--------------------------|-------------------|
| Edge Function atual | R$ 1.496.628 | NAO (< R$ 1.600.000) |
| Frontend (precos fixos) | R$ 2.013.894 | SIM (>= R$ 1.600.000) |

## Causa Raiz

A funcao `getDeduplicatedGross` na Edge Function (linhas 499-517) nao aplica os precos fixos:

```javascript
// Regra 4: E primeira - usar product_price
return tx.product_price || 0;  // BUG: deveria usar preco fixo!
```

O frontend usa `getFixedGrossPrice()` que substitui por valores fixos:
- A009 (MCF + The Club) = R$ 19.500
- A001 (MCF Completo) = R$ 14.500
- A005 (P2) = R$ 0
- A000/Contrato = R$ 497
- etc.

## Solucao

Atualizar a Edge Function para aplicar os mesmos precos fixos do frontend.

### Arquivo a Modificar

**supabase/functions/recalculate-sdr-payout/index.ts**

### Alteracoes

#### 1. Adicionar mapa de precos fixos (apos linha 30)

```javascript
// Precos fixos por produto (sincronizado com frontend incorporadorPricing.ts)
const FIXED_GROSS_PRICES: { pattern: string; price: number }[] = [
  { pattern: 'a005', price: 0 },  // MCF P2 nao conta no faturamento
  { pattern: 'mcf p2', price: 0 },
  { pattern: 'a009', price: 19500 },  // MCF + The Club
  { pattern: 'a001', price: 14500 },  // MCF Completo
  { pattern: 'a000', price: 497 },    // Contrato
  { pattern: 'contrato', price: 497 },
  { pattern: 'a010', price: 47 },
  { pattern: 'plano construtor', price: 997 },
  { pattern: 'a004', price: 5500 },   // Anticrise Basico
  { pattern: 'a003', price: 7500 },   // Anticrise Completo
];

const getFixedGrossPrice = (productName: string | null, originalPrice: number): number => {
  if (!productName) return originalPrice;
  const normalizedName = productName.toLowerCase().trim();
  
  for (const { pattern, price } of FIXED_GROSS_PRICES) {
    if (normalizedName.includes(pattern)) {
      return price;
    }
  }
  
  return originalPrice;
};
```

#### 2. Atualizar getDeduplicatedGross (linha 517)

De:
```javascript
// Regra 4: E primeira - usar product_price
return tx.product_price || 0;
```

Para:
```javascript
// Regra 4: E primeira - usar preco fixo do produto
return getFixedGrossPrice(tx.product_name, tx.product_price || 0);
```

## Fluxo Apos Correcao

```text
1. Edge Function calcula faturamento Incorporador = R$ 2.013.894
2. buUltrametaHit['incorporador'] = true (2.013.894 >= 1.600.000)
3. Para cada SDR/Closer elegivel da BU:
   - ifood_ultrameta = R$ 1.000
   - total_ifood = ifood_mensal + R$ 1.000
4. Thayna, Julio, Julia, Julia Caroline, etc. receberao o bonus
```

## Resultado Esperado

Apos recalcular os payouts de Janeiro 2026:

| Campo | Antes | Depois |
|-------|-------|--------|
| Faturamento Calculado | R$ 1.496.628 | R$ 2.013.894 |
| Ultrameta Batida | NAO | SIM |
| iFood Ultrameta | R$ 0 | R$ 1.000 |
| Total iFood (ex: Thayna) | R$ 600 | R$ 1.600 |

## Observacao

Colaboradores que entraram durante Janeiro 2026 (como Ygor Fereira e Victoria da Silva Paz) **nao** receberao o bonus de Ultrameta - essa regra de elegibilidade ja esta implementada e continuara funcionando.
