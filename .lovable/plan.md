

## Plano: Metas dinâmicas baseadas em R1 Agendada

### Lógica atual
Todas as 8 metas (dia/semana/mês) vêm de valores fixos no banco (`team_targets`).

### Nova lógica
Apenas **Agendamento** e **R1 Agendada** mantêm meta fixa do banco. As demais são calculadas dinamicamente:

| Métrica | Meta = |
|---|---|
| Agendamento | Fixa (banco) |
| R1 Agendada | Fixa (banco) |
| R1 Realizada | 70% do **valor atual** de R1 Agendada |
| No-Show | 30% do **valor atual** de R1 Agendada |
| Contrato Pago | 30% da **meta** de R1 Realizada |
| R2 Agendada | Fixa (banco / agenda) |
| R2 Realizada | 70% do **valor atual** de R2 Agendada |
| Venda Realizada | 30% do **valor atual** de R2 Agendada |

### Mudança técnica

**Arquivo:** `src/components/sdr/TeamGoalsPanel.tsx`

Alterar os `useMemo` de `dayTargets`, `weekTargets` e `monthTargets` para calcular as metas derivadas a partir dos valores reais (`dayValues`, `weekValues`, `monthValues`):

```typescript
const dayTargets = useMemo(() => ({
  agendamento: getTargetValue('agendamento_dia'),
  r1Agendada: getTargetValue('r1_agendada_dia'),
  r1Realizada: Math.round(dayValues.r1Agendada * 0.7),
  noShow: Math.round(dayValues.r1Agendada * 0.3),
  contrato: Math.round(dayValues.r1Agendada * 0.7 * 0.3),
  r2Agendada: getTargetValue('r2_agendada_dia'),
  r2Realizada: Math.round(dayValues.r2Agendada * 0.7),
  vendaRealizada: Math.round(dayValues.r2Agendada * 0.3),
}), [targets, buPrefix, dayValues]);
// Mesma lógica para weekTargets e monthTargets
```

Isso remove a necessidade de configurar manualmente as metas derivadas no banco, mantendo apenas Agendamento, R1 Agendada e R2 Agendada como editáveis.

