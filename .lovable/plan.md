
# Corrigir Meta de R1 Realizadas: Usar 70% dos Agendamentos Realizados

## Problema

A meta de "R1 Realizadas" no card está usando 70% da **META** de agendamentos, mas deveria usar 70% dos **AGENDAMENTOS REALIZADOS** (igual ao formulário "Editar KPIs").

| Local | Lógica Atual | Valor |
|-------|--------------|-------|
| Editar KPIs | `181 × 0.7` | **127** (correto) |
| Card Indicador | `180 × 0.7` | **126** (errado) |

## Solucao

Modificar o `DynamicIndicatorCard.tsx` para calcular a meta de "realizadas" usando 70% do valor real de agendamentos do KPI (`kpi.reunioes_agendadas`).

### Alteracao no Codigo

**Arquivo:** `src/components/fechamento/DynamicIndicatorCard.tsx`

**Linhas 151-156 - ANTES:**
```typescript
} else if (metrica.nome_metrica === 'realizadas') {
  // PRIORIDADE: payout (recalculado) > compPlan > 70% da meta de agendadas
  metaAjustada = payout.meta_realizadas_ajustada
    || compPlan?.meta_reunioes_realizadas
    || Math.round((payout.meta_agendadas_ajustada || sdrMetaDiaria * diasUteisMes) * 0.7);
  meta = Math.round(metaAjustada / diasUteisMes);
}
```

**DEPOIS:**
```typescript
} else if (metrica.nome_metrica === 'realizadas') {
  // Meta de Realizadas = 70% dos AGENDAMENTOS REALIZADOS (kpi.reunioes_agendadas)
  // Isso garante consistência com o formulário "Editar KPIs"
  const agendamentosRealizados = kpi?.reunioes_agendadas || 0;
  metaAjustada = Math.round(agendamentosRealizados * 0.7);
  meta = Math.round(metaAjustada / diasUteisMes);
}
```

## Resultado Esperado

Ambas as telas mostrarão a mesma meta:

| Indicador | Editar KPIs | Card |
|-----------|-------------|------|
| R1 Realizadas | **127** (70% de 181) | **127** (70% de 181) |

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/fechamento/DynamicIndicatorCard.tsx` | Usar `kpi.reunioes_agendadas` para calcular meta de realizadas |
