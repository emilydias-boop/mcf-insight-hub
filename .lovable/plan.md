

## Corrigir cálculo de valor base: usar pesos configurados em vez de valores fixos do CompPlan

### Problema
Você configurou os pesos das métricas (30%, 40%, 20%, 10%) na aba "Métricas Ativas", mas os cards de indicadores ignoram esses pesos e usam os valores fixos do Plano OTE (`valor_meta_rpg = R$ 400`, `valor_docs_reuniao = R$ 400`, `valor_tentativas = R$ 200`, `valor_organizacao = R$ 200`).

Isso acontece porque o código prioriza o valor do CompPlan **antes** de tentar o cálculo por peso percentual.

### Solução
Inverter a prioridade: usar **primeiro** o cálculo por peso (`variavel_total × peso_percentual / 100`), e só recorrer ao valor fixo do CompPlan como fallback quando não houver peso configurado.

### Alterações

1. **`src/components/fechamento/DynamicIndicatorCard.tsx`** (linhas 186-201)
   - Inverter a lógica: primeiro tentar `peso_percentual`, depois fallback para `compPlanValueField`

2. **`src/hooks/useCalculatedVariavel.ts`** (linhas 130-140)
   - Mesma inversão de prioridade para manter consistência entre cards e totais

### Resultado esperado
Com `variavel_total = R$ 1.000` e pesos 30/40/20/10:
- Agendamentos: R$ 300 (30%)
- R1 Realizadas: R$ 400 (40%)
- Contratos Pagos: R$ 200 (20%)
- Tentativas: R$ 100 (10%)

