## Contexto

Hoje no card "Contratos" desta semana aparecem leads que:
- Pagaram A000 Qui/Sex (safra atual) ✅
- Fizeram R2 Qui/Sex (safra atual) ✅
- **Mas a parceria deles foi paga numa janela `vendasParceria` da semana ANTERIOR** (Sex anterior 12:00 → Seg desta semana 23:59)

Esses leads não são "parceiros novos desta semana" — eles já foram contabilizados como parceria no carrinho passado. Você precisa de um indicador para identificá-los.

## Mudança proposta

### 1. Nova métrica em `useR2CarrinhoKPIs.ts`

Adicionar `contratosComParceriaSemanaAnterior: number`:

- Para a janela `vendasParceria` da **semana ANTERIOR** (Sex passada 12:00 → Seg desta semana 23:59 da safra anterior), buscar todos os emails que compraram parceria (A001-A009/R001/INCORPORADOR/Renovação/Parceria).
- Cruzar com os emails que estão no `contratosPagos` desta safra (A000 pago Qui→Qua atual).
- Contar a interseção.

Implementação: nova query paralela à existente `r2-carrinho-contratos`, calculando `boundaries` da semana anterior (`weekStart - 7`, `weekEnd - 7`) via `getCarrinhoMetricBoundaries`, pegando `vendasParceria.start` e `vendasParceria.end` daquela semana, e buscando parcerias nessa janela. Depois interseccionar com o `emailMap` dos contratos atuais.

### 2. Sub-badge no card "Contratos" em `R2Carrinho.tsx`

Adicionar abaixo do número de contratos:
- `★ {N} c/ parceria da semana anterior`
- Tooltip: "Contratos pagos nesta safra cujo lead já havia comprado parceria na janela de parceria da semana anterior (Sex 12:00 → Seg 23:59 da safra passada). Por isso aparecem aqui em contratos novos, mas operacionalmente já são parceiros."

### 3. (Opcional) Drill-down

Tornar o badge clicável abrindo modal com nome, email, data do A000, data da parceria e produto.

## Resultado

- Card "Contratos" continua mostrando o total real (ex.: 21).
- Sub-badge mostra quantos desses (ex.: 4) já tinham parceria contabilizada na semana anterior.
- Você consegue responder "por que esse lead conta em contratos se ele é parceiro?" → "porque a parceria dele foi atribuída à semana passada".

## Detalhes técnicos

- Em `useR2CarrinhoKPIs.ts`, dentro da query `r2-carrinho-contratos`:
  - Calcular `prevBoundaries = getCarrinhoMetricBoundaries(subDays(weekStart, 7), subDays(weekEnd, 7), previousConfig, undefined)`.
  - Query adicional em `hubla_transactions` com `sale_date BETWEEN prevBoundaries.vendasParceria.start AND prevBoundaries.vendasParceria.end` e o mesmo filtro `or(...)` de produtos de parceria.
  - Coletar `prevWeekPartnerEmails: Set<string>`.
  - No `emailMap` de contratos desta safra, contar quantos emails pertencem a `prevWeekPartnerEmails` → retornar como `contratosComParceriaSemanaAnterior`.
- Adicionar campo no tipo `R2CarrinhoKPIs` e propagar até `R2Carrinho.tsx`.
- Renderizar como `Badge` discreto dentro do card "Contratos" usando o mesmo padrão visual dos outros sub-indicadores (`★ N c/ parceria nova` já existente em outros cards).
