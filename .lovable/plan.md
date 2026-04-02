

## Unificar cálculo dos indicadores: remover dependência do CompPlan

### Problema
Os cards de indicadores não refletem as métricas configuradas. Você configurou Agendamentos (30%), R1 Realizadas (40%), Contratos Pagos (20%), Tentativas (10%), mas aparece "Organização" no lugar de "Contratos Pagos". Isso ocorre porque o código tem duas ramificações de cálculo — uma para métricas com `isDynamicCalc` (contratos) e outra para métricas com campos de payout (agendamentos, realizadas, tentativas, organizacao). A ramificação antiga depende do CompPlan para determinar valores fixos.

### Solução
Unificar TODAS as métricas para usar o mesmo cálculo baseado em peso percentual da tabela `fechamento_metricas_mes`, eliminando a dependência do CompPlan nos indicadores.

### Alterações

1. **`src/hooks/useActiveMetricsForSdr.ts`** — METRIC_CONFIG (linhas 256-341)
   - Remover `compPlanValueField` de TODAS as métricas (agendamentos, realizadas, tentativas, organizacao)
   - Marcar TODAS as métricas ativas como `isDynamicCalc: true` para que usem o mesmo fluxo de cálculo unificado
   - Manter `kpiField`, `icon`, `color`, `isAuto`, `autoSource`, `isPercentage`

2. **`src/components/fechamento/DynamicIndicatorCard.tsx`** (linhas 50-252)
   - Remover prop `compPlan` do componente e do grid
   - Unificar o cálculo: TODAS as métricas usam `valorBase = variavelTotal * peso_percentual / 100`
   - Manter lógica de meta diferenciada por tipo (agendamentos usa meta diária, realizadas usa 70% agendadas, tentativas usa meta diária, organizacao usa 100%, contratos usa % realizadas)
   - Remover a ramificação `payoutPctField` — tudo passa pelo mesmo fluxo

3. **`src/hooks/useCalculatedVariavel.ts`** (linhas 1-168)
   - Remover prop `compPlan` da interface e do hook
   - Unificar: todas as métricas calculam `valorBase = variavelTotal * peso_percentual / 100`
   - Manter lógica de meta por tipo de métrica
   - Fallback: se `peso_percentual` não definido, usar `100 / metricas.length` (distribuição igual)

4. **`src/pages/fechamento-sdr/Detail.tsx`**
   - Remover `compPlan` das props de `DynamicIndicatorsSection` e `useCalculatedVariavel`
   - Manter `variavelTotal` vindo de `cargo_catalogo.variavel_valor` (já funciona como fallback)

5. **`src/components/fechamento/PayoutTableRow.tsx`**
   - Remover `compPlan` do `useCalculatedVariavel`
   - `variavelTotal` já vem do `compPlan?.variavel_total || cargo_catalogo`, manter apenas o valor numérico

### Resultado esperado
Com `variavelTotal = R$ 1.200` e pesos 30/40/20/10:
- Agendamentos R1: R$ 360 (30%)
- R1 Realizadas: R$ 480 (40%)
- Contratos Pagos: R$ 240 (20%)
- Tentativas: R$ 120 (10%)

Organização NÃO aparece porque não está ativa na configuração.

