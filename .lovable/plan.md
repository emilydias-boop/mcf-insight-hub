

# Plano: Corrigir Cálculo de Payout Usando Pesos das Métricas Ativas

## Problema Atual

O motor de cálculo (`calculatePayoutValues`) ignora completamente as configurações de "Métricas Ativas" (tabela `fechamento_metricas_mes`). Ele usa valores fixos hardcoded no `sdr_comp_plan`:

```typescript
// Cálculo atual (errado)
const valor_reunioes_agendadas = compPlan.valor_meta_rpg * mult_reunioes_agendadas;
const valor_reunioes_realizadas = compPlan.valor_docs_reuniao * mult_reunioes_realizadas;
const valor_tentativas = compPlan.valor_tentativas * mult_tentativas;
const valor_organizacao = compPlan.valor_organizacao * mult_organizacao;
```

Isso causa desconexão entre o que está configurado em "Métricas Ativas" e o que é calculado no fechamento.

---

## Como Deveria Funcionar (Baseado na Planilha de Referência)

Para um SDR com:
- OTE Total: R$ 4.000
- Fixo (70%): R$ 2.800
- Variável (30%): R$ 1.200

Com métricas configuradas (pesos somando 100%):
- Agendadas: 33.33% → R$ 400 do variável
- Realizadas: 33.33% → R$ 400 do variável
- Tentativas: 16.67% → R$ 200 do variável
- Organização: 16.67% → R$ 200 do variável

O cálculo final por métrica:
- **Valor Base** = `variavel_total × peso_percentual / 100`
- **Valor Final** = `Valor Base × Multiplicador`

O multiplicador é determinado pelo percentual de atingimento:

| Performance | Multiplicador |
|-------------|---------------|
| 0-70%       | 0.0           |
| 71-85%      | 0.5           |
| 86-99%      | 0.7           |
| 100-119%    | 1.0           |
| ≥120%       | 1.5           |

---

## Solução Técnica

### 1. Modificar `calculatePayoutValues` para usar métricas dinâmicas

**Arquivo:** `src/hooks/useSdrFechamento.ts`

Refatorar a função para:
1. Receber as métricas ativas como parâmetro
2. Calcular o valor base de cada métrica usando `variavel_total × peso_percentual / 100`
3. Aplicar o multiplicador correspondente ao % de atingimento

```typescript
const calculatePayoutValuesDynamic = (
  compPlan: SdrCompPlan,
  kpi: SdrMonthKpi,
  activeMetrics: ActiveMetric[], // Métricas ativas do cargo/mês
  sdrMetaDiaria?: number,
  diasUteisMes?: number
) => {
  const diasUteisReal = diasUteisMes || compPlan.dias_uteis || 19;
  const variavelTotal = compPlan.variavel_total;

  // Para cada métrica ativa, calcular: valor_base = variavel × peso%
  // e aplicar multiplicador baseado na performance

  const results: Record<string, {
    meta: number;
    realizado: number;
    pct: number;
    mult: number;
    valorBase: number;
    valorFinal: number;
  }> = {};

  activeMetrics.forEach(metric => {
    const valorBase = variavelTotal * (metric.peso_percentual / 100);
    const { meta, realizado, pct } = calculateMetricPerformance(
      metric.nome_metrica, 
      kpi, 
      compPlan, 
      diasUteisReal, 
      sdrMetaDiaria
    );
    const mult = getMultiplier(pct);
    const valorFinal = valorBase * mult;

    results[metric.nome_metrica] = {
      meta,
      realizado,
      pct,
      mult,
      valorBase,
      valorFinal,
    };
  });

  const valorVariavelTotal = Object.values(results)
    .reduce((sum, r) => sum + r.valorFinal, 0);

  return {
    metrics: results,
    valor_variavel_total: valorVariavelTotal,
    valor_fixo: compPlan.fixo_valor,
    total_conta: compPlan.fixo_valor + valorVariavelTotal,
    // ... manter campos legacy para compatibilidade
  };
};
```

### 2. Criar helper para calcular performance de cada métrica

**Arquivo:** `src/hooks/useSdrFechamento.ts`

```typescript
const calculateMetricPerformance = (
  metricName: string,
  kpi: SdrMonthKpi,
  compPlan: SdrCompPlan,
  diasUteis: number,
  metaDiaria?: number
): { meta: number; realizado: number; pct: number } => {
  switch (metricName) {
    case 'agendamentos':
      const metaAgendadas = (metaDiaria || 0) * diasUteis;
      return {
        meta: metaAgendadas,
        realizado: kpi.reunioes_agendadas,
        pct: metaAgendadas > 0 
          ? (kpi.reunioes_agendadas / metaAgendadas) * 100 
          : 0,
      };
    
    case 'realizadas':
      // Meta = 70% do que foi REALMENTE agendado
      const metaRealizadas = Math.round(kpi.reunioes_agendadas * 0.7);
      return {
        meta: metaRealizadas,
        realizado: kpi.reunioes_realizadas,
        pct: metaRealizadas > 0 
          ? (kpi.reunioes_realizadas / metaRealizadas) * 100 
          : 0,
      };
    
    case 'tentativas':
      const metaTentativas = 84 * diasUteis; // 84/dia fixo
      return {
        meta: metaTentativas,
        realizado: kpi.tentativas_ligacoes,
        pct: metaTentativas > 0 
          ? (kpi.tentativas_ligacoes / metaTentativas) * 100 
          : 0,
      };
    
    case 'organizacao':
      return {
        meta: 100,
        realizado: kpi.score_organizacao,
        pct: kpi.score_organizacao, // já é percentual
      };
    
    case 'no_show':
      return {
        meta: 30, // Meta de no-show = 30% máximo
        realizado: kpi.no_shows,
        pct: calculateNoShowPerformance(kpi.no_shows, kpi.reunioes_agendadas),
      };
    
    case 'contratos':
      const metaContratos = compPlan.meta_reunioes_realizadas || 10;
      return {
        meta: metaContratos,
        realizado: kpi.intermediacoes_contrato,
        pct: metaContratos > 0 
          ? (kpi.intermediacoes_contrato / metaContratos) * 100 
          : 0,
      };
    
    // ... outros casos
    default:
      return { meta: 0, realizado: 0, pct: 0 };
  }
};
```

### 3. Modificar `useRecalculatePayout` para buscar métricas ativas

**Arquivo:** `src/hooks/useSdrFechamento.ts`

Antes de calcular, buscar as métricas ativas do cargo do colaborador:

```typescript
// Dentro de useRecalculatePayout
// 1. Buscar employee e cargo_catalogo_id
const { data: employeeData } = await supabase
  .from('employees')
  .select('departamento, cargo_catalogo_id')
  .eq('sdr_id', sdrId)
  .eq('status', 'ativo')
  .maybeSingle();

// 2. Buscar métricas ativas para o cargo/mês
const { data: activeMetrics } = await supabase
  .from('fechamento_metricas_mes')
  .select('*')
  .eq('ano_mes', anoMes)
  .eq('cargo_catalogo_id', employeeData?.cargo_catalogo_id)
  .eq('ativo', true);

// 3. Usar métricas no cálculo
const calculatedValues = calculatePayoutValuesDynamic(
  compPlan,
  kpi,
  activeMetrics || DEFAULT_METRICS,
  sdrRecord.meta_diaria,
  diasUteisMes
);
```

### 4. Atualizar estrutura do `sdr_month_payout` para armazenar dados dinâmicos

A tabela `sdr_month_payout` já tem campos para cada métrica individual (valor_reunioes_agendadas, etc). Podemos:
- **Opção A**: Manter compatibilidade - preencher os campos existentes baseado nas métricas ativas
- **Opção B**: Adicionar coluna JSON para métricas dinâmicas

Vou usar **Opção A** para não quebrar a estrutura existente.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSdrFechamento.ts` | Refatorar `calculatePayoutValues` para usar métricas dinâmicas |
| `src/hooks/useSdrFechamento.ts` | Criar helper `calculateMetricPerformance` |
| `src/hooks/useSdrFechamento.ts` | Atualizar `useRecalculatePayout` para buscar e usar métricas ativas |
| `src/hooks/useSdrFechamento.ts` | Atualizar `useRecalculateAllPayouts` com mesma lógica |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ANTES (errado)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Recalcular → calculatePayoutValues usa compPlan.valor_meta_rpg fixo        │
│             → Ignora configuração de "Métricas Ativas"                      │
│             → Ignora pesos percentuais configurados                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              DEPOIS (correto)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Recalcular → Busca cargo_catalogo_id do employee                        │
│  2. Busca métricas ativas (fechamento_metricas_mes)                         │
│  3. Para cada métrica ativa:                                                │
│     a. Calcula valor_base = variavel_total × peso% / 100                    │
│     b. Calcula performance% (realizado / meta × 100)                        │
│     c. Obtém multiplicador pela tabela de faixas                            │
│     d. Calcula valor_final = valor_base × multiplicador                     │
│  4. Soma todos os valores_finais → valor_variavel_total                     │
│  5. total_conta = fixo + variavel_total                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Exemplo de Cálculo Correto

SDR com variável = R$ 1.200 e métricas configuradas:

| Métrica       | Peso  | Valor Base | Realizado | Meta | Performance | Mult | Valor Final |
|---------------|-------|------------|-----------|------|-------------|------|-------------|
| Agendadas     | 33.3% | R$ 400     | 94        | 115  | 81.74%      | 0.7  | R$ 280      |
| Realizadas    | 33.3% | R$ 400     | 65        | 65   | 100%        | 1.0  | R$ 400      |
| Tentativas    | 16.7% | R$ 200     | 2054      | 1932 | 106%        | 1.0  | R$ 200      |
| Organização   | 16.7% | R$ 200     | 25        | 100  | 25%         | 0.0  | R$ 0        |
| **TOTAL**     | 100%  | R$ 1.200   |           |      |             |      | **R$ 880**  |

Valor Final = Fixo (R$ 2.800) + Variável (R$ 880) = **R$ 3.680**

---

## Impacto

- **Métricas Ativas passam a influenciar o cálculo real**: O que está configurado na aba "Métricas Ativas" será usado no motor de fechamento
- **Pesos percentuais são respeitados**: A distribuição do variável segue exatamente a configuração
- **Multiplicadores continuam funcionando**: A tabela de faixas (0-70% = 0, 71-85% = 0.5, etc) permanece
- **Compatibilidade mantida**: Os campos existentes do payout continuam preenchidos

