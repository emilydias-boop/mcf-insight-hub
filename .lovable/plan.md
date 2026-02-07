
# ✅ Corrigir Inconsistência de Metas entre Cards e Formulário de KPIs

**Status: CONCLUÍDO**

## Alteração Realizada

Modificado `DynamicIndicatorCard.tsx` para priorizar as metas ajustadas do **payout** sobre o compPlan:

```typescript
// Agendamentos - nova hierarquia:
metaAjustada = payout.meta_agendadas_ajustada 
  || compPlan?.meta_reunioes_agendadas 
  || (sdrMetaDiaria * diasUteisMes);
meta = Math.round(metaAjustada / diasUteisMes);

// Realizadas - nova hierarquia:
metaAjustada = payout.meta_realizadas_ajustada
  || compPlan?.meta_reunioes_realizadas
  || Math.round((payout.meta_agendadas_ajustada || sdrMetaDiaria * diasUteisMes) * 0.7);
meta = Math.round(metaAjustada / diasUteisMes);
```

## Resultado

Agora os cards de indicadores exibem as mesmas metas do formulário "Editar KPIs", pois ambos usam os valores recalculados do payout.
