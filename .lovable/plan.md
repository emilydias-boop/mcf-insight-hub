
# Remover a010 do KPI de Parcerias

## Problema

O KPI card "Parcerias" no topo do popup esta contando 77 transacoes incluindo as 55 de A010. O usuario quer que A010 nao seja contado no KPI de Parcerias (apenas `parceria` e `renovacao`).

A010 deve continuar aparecendo na tabela "Detalhamento de Parcerias" abaixo, mas nao inflar os numeros do KPI card.

## Secao Tecnica

### Arquivo: `src/components/relatorios/CloserRevenueDetailDialog.tsx`

### Mudanca

Linha 109-111 — remover `a010` do filtro de parcerias usado nos KPIs:

De:
```text
const parcerias = transactions.filter(
  (t) => t.product_category === 'parceria' || t.product_category === 'a010' || t.product_category === 'renovacao'
);
```

Para:
```text
const parcerias = transactions.filter(
  (t) => t.product_category === 'parceria' || t.product_category === 'renovacao'
);
```

### Resultado

- KPI "Parcerias": mostrara 22 transacoes (77 - 55) com bruto/liquido sem A010
- Tabela "Detalhamento de Parcerias": continua mostrando A010 (pois usa `parceriaMap` que tem logica separada)
- Breakdown por Categoria: A010 continua agrupado como `parceria` (sem mudanca)
