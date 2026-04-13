

# Plano: Unificar No-Show do Closer para usar subtração

## Alteração

**`src/hooks/useR1CloserMetrics.ts`**

1. **Remover** a contagem explícita de `status === 'no_show'` (linhas 516-519)
2. **Adicionar** após o loop (antes da linha 525), cálculo por subtração para cada closer:

```typescript
// Calcular no-show por subtração: R1 Agendada - R1 Realizada
metricsMap.forEach(metric => {
  metric.noshow = Math.max(0, metric.r1_agendada - metric.r1_realizada);
});
```

## Resultado
- Closer e SDR usarão a mesma fórmula: `no_show = r1_agendada - r1_realizada`
- Leads com status `invited` (reunião passou sem atualização) aparecerão como no-show, forçando a equipe a corrigir
- Os números ficarão consistentes entre as duas abas

