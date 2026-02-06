
# Corrigir Exibição da Meta de R1 Realizadas

## Problema Identificado

A interface está exibindo a meta de "R1 Realizadas" incorretamente:
- **Exibido**: Meta 78 (calculado como 70% do REALIZADO de agendadas: 112 × 0.7)
- **Correto**: Meta 126 (calculado como 70% da META TEÓRICA de agendadas: 180 × 0.7)

O percentual está correto (54.8% = 69/126), pois a Edge Function usa a meta teórica. Apenas a exibição da meta na interface está errada.

## Arquivo a Modificar

**src/components/fechamento/DynamicIndicatorCard.tsx**

### Alteração (Linhas 169-171)

Código atual:
```javascript
} else if (metrica.nome_metrica === 'realizadas') {
  meta = kpi?.reunioes_agendadas || 0;  // Usa REALIZADO de agendadas - ERRADO
  metaAjustada = Math.round((kpi?.reunioes_agendadas || 0) * 0.7);
}
```

Código corrigido:
```javascript
} else if (metrica.nome_metrica === 'realizadas') {
  // Usar a meta teórica de agendadas do compPlan ou calcular (metaDiaria × diasUteis)
  const metaTeoricaAgendadas = compPlan?.meta_reunioes_agendadas || (sdrMetaDiaria * diasUteisMes);
  // Meta de realizadas = 70% da meta teórica de agendadas (conforme regra de negócio)
  meta = Math.round(metaTeoricaAgendadas / diasUteisMes);
  metaAjustada = Math.round(metaTeoricaAgendadas * 0.7);
}
```

## Resultado Esperado

Após a correção, o indicador "R1 Realizadas" exibirá:
- **Meta**: 126 (ou valor calculado de 70% da meta teórica)
- **Realizado**: 69
- **Percentual**: 54.8% (consistente com a Edge Function)

## Impacto

Esta correção alinha a interface com a lógica da Edge Function e com a regra de negócio documentada:
> "The 'Realizadas' (Completed) target is calculated as 70% of the theoretical monthly 'Agendadas' target, not the actual performance"
