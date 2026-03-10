

## Problema: KPI Form mostra meta fixa em vez de 30% dinâmica para Contratos Pagos

### Causa raiz
O card de indicadores (`DynamicIndicatorCard`) tem um fallback no código (linhas 111-115): quando `meta_percentual` é `null` e a métrica é `contratos`, ele assume 30% das Realizadas. Porém o formulário de KPIs (`KpiEditForm`) **não tem esse fallback** -- quando `metaContratosPercentual` é `undefined`, ele cai na fórmula fixa `metaContratosDiaria × diasUteisMes = 22`.

Na base de dados, a row de `fechamento_metricas_mes` para este closer (cargo `fd8d5a86`, squad `incorporador`, mês `2026-03`) tem `meta_percentual: null` e não existe row genérica (squad=null) como fallback.

### Correção

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `KpiEditForm.tsx` (linhas 75-79) | Adicionar fallback: se `metaContratosPercentual` é undefined/null e `roleType === 'closer'`, usar 30% como default |
| 2 | `KpiEditForm.tsx` (linhas 287-291) | Atualizar o texto do subtítulo para refletir o fallback de 30% |

### Código proposto

```typescript
// Linha 75-79 - Antes:
const metaContratosCalculada = metaContratosPercentual && metaContratosPercentual > 0
  ? Math.round((realizadasAtual * metaContratosPercentual) / 100)
  : metaContratosDiaria * diasUteisMes;

// Depois:
const effectiveMetaContratosPercentual = metaContratosPercentual 
  || (isCloser ? 30 : undefined); // Closers: fallback 30%

const metaContratosCalculada = effectiveMetaContratosPercentual && effectiveMetaContratosPercentual > 0
  ? Math.round((realizadasAtual * effectiveMetaContratosPercentual) / 100)
  : metaContratosDiaria * diasUteisMes;
```

E atualizar o subtítulo (linha 288) para usar `effectiveMetaContratosPercentual` em vez de `metaContratosPercentual`.

### Resultado esperado
- Contratos Pagos no form mostrará: **"Meta: 30% de 44 Realizadas = 13"** em vez de "Meta: 22 (1/dia × 22 dias)"
- Consistência entre o form (topo) e os indicadores (embaixo)

