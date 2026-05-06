## Objetivo

Corrigir as janelas do Carrinho R2 para refletir as três janelas distintas que o usuário descreveu.

## Regras corretas

| Bloco | Janela |
|---|---|
| **Safra (Contratos + R1)** | **Qui 00:00 → Qua 23:59** — fixa, sem corte intra-dia |
| **Janela do Carrinho R2** (R2s, Aprovados, operacional) | **Sáb 00:00 → Sex (dia/horário do corte)** da semana seguinte |
| **Vendas Parceria** | **Sex (corte) → Dom 23:59** da mesma semana |

Exemplo (safra atual 30/04 Qui → 06/05 Qua, corte Sex 08/05 12:00):
- Safra Contratos / R1: 30/04 00:00 → 06/05 23:59
- Janela Carrinho R2: **02/05 00:00 (Sáb) → 08/05 12:00 (Sex corte)**
- Vendas Parceria: **08/05 12:00 (Sex corte) → 10/05 23:59 (Dom)**

## Mudanças (apenas frontend / lógica de janelas)

### 1. `src/lib/carrinhoWeekBoundaries.ts` — `getCarrinhoMetricBoundaries`

| Métrica | Janela nova |
|---|---|
| `contratos` | Qui 00:00 → Qua 23:59 (mantém) |
| `r1Meetings` | Qui 00:00 → Qua 23:59 (mantém) |
| `r2Meetings` | **Sáb 00:00 → Sex(corte com horário)** |
| `aprovados` | **Sáb 00:00 → Sex(corte com horário)** |
| `carrinhoOperacional` | **Sáb 00:00 → Sex(corte com horário)** |
| `vendasParceria` | **Sex(corte com horário) → Dom 23:59** (mesma semana, em vez de Seg) |
| `previousCutoff` / `safraOpeningCutoff` | Qui 00:00 da safra (mantém) |

Detalhes de cálculo:
- "Sáb" = `weekStart + 2 dias` à 00:00 local (sábado dentro do intervalo Qui→Qua da safra).
- "Sex(corte)" = já existe como `currentCutoff` (dia derivado de `dia_corte`/`dias` + `horario_corte`).
- "Dom" = `currentCutoffDay + 2 dias` às 23:59:59.999 local.

### 2. UI do header em `/crm/r2-carrinho`

Atualizar o chip "Janela do Carrinho (R2s)" para usar `boundaries.carrinhoOperacional` (vai exibir, p.ex., "02/05 00:00 → 08/05 12:00"). Atualizar também o texto de "Vendas Parceria" caso esteja exibido, refletindo Sex(corte) → Dom.

### 3. Memória

Atualizar `mem://reporting/carrinho-safra-operational-logic-v6` → v7 com as três janelas:
- Safra (Contratos/R1) fixa Qui→Qua
- Carrinho R2 (R2s/Aprovados/operacional) Sáb→Sex(corte)
- Vendas Parceria Sex(corte)→Dom

## Fora de escopo

- Sem mudança em schema, RPC SQL ou edge functions.
- Sem mudança em métricas de SDR, R1, Contratos.
- Hooks de KPI (incluindo `useSDRCarrinhoMetrics`, `useCarrinhoUnifiedData`) já consomem `boundaries.*` e herdam o ajuste automaticamente.

## Validação

Na safra atual (30/04 → 06/05, corte 08/05 12:00):
- Header: "Janela do Carrinho (R2s): 02/05 00:00 → 08/05 12:00".
- Aprovados / R2 contam apenas eventos Sáb 02/05 → Sex 08/05 12:00.
- Contratos pagos e R1 continuam Qui→Qua.
- Vendas Parceria contam Sex 08/05 12:00 → Dom 10/05 23:59.
