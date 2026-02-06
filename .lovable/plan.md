
# Sincronizar Cálculos Entre Frontend e Payout

## Problema

A interface exibe a meta do compPlan (120), mas usa a porcentagem calculada pelo payout (54.76%, baseada em meta 126). Isso causa inconsistência nos valores mostrados ao usuário.

## Causa Raiz

O frontend foi corrigido para usar `compPlan.meta_reunioes_agendadas`, mas continua lendo `pct`, `mult` e `valorFinal` diretamente do payout, que foi calculado com uma meta diferente.

## Solucao

Recalcular localmente a porcentagem, multiplicador e valor final na interface quando houver um valor de meta no compPlan, garantindo consistencia visual.

### Arquivo a Modificar

**src/components/fechamento/DynamicIndicatorCard.tsx**

### Alteracao (Linhas 139-196)

Logica atual:
```javascript
if (config.payoutPctField && config.payoutMultField && config.payoutValueField) {
  // Le pct, mult, valorFinal direto do payout
  const pct = (payout as any)[config.payoutPctField] || 0;
  const mult = (payout as any)[config.payoutMultField] || 0;
  const valorFinal = (payout as any)[config.payoutValueField] || 0;
  
  // Calcula meta localmente...
  if (metrica.nome_metrica === 'realizadas') {
    const metaTeoricaAgendadas = compPlan?.meta_reunioes_agendadas || ...;
    metaAjustada = Math.round(metaTeoricaAgendadas * 0.7);
  }
  
  // PROBLEMA: Meta local vs Pct do payout = inconsistente!
}
```

Nova logica:
```javascript
if (config.payoutPctField && config.payoutMultField && config.payoutValueField) {
  // Calcular meta primeiro
  let meta = 0;
  let metaAjustada = 0;
  
  if (metrica.nome_metrica === 'realizadas') {
    const metaTeoricaAgendadas = compPlan?.meta_reunioes_agendadas || (sdrMetaDiaria * diasUteisMes);
    meta = Math.round(metaTeoricaAgendadas / diasUteisMes);
    metaAjustada = Math.round(metaTeoricaAgendadas * 0.7);
  } else if (metrica.nome_metrica === 'agendamentos') {
    meta = sdrMetaDiaria;
    metaAjustada = compPlan?.meta_reunioes_agendadas || (sdrMetaDiaria * diasUteisMes);
  } else if (...) {
    // outras metricas
  }

  // RECALCULAR porcentagem localmente para garantir consistencia
  const pct = metaAjustada > 0 ? (kpiValue / metaAjustada) * 100 : 0;
  const mult = getMultiplier(pct);
  
  // Valor base com prioridade para compPlan
  let valorBase = 0;
  if (config.compPlanValueField && compPlan) {
    valorBase = (compPlan as any)[config.compPlanValueField] || 0;
  }
  if (valorBase === 0) {
    valorBase = (variavelTotal || compPlan?.variavel_total || 1200) * (metrica.peso_percentual || 25) / 100;
  }
  
  // Valor final = base x multiplicador
  const valorFinal = valorBase * mult;

  return (
    <SdrIndicatorCard
      title={metrica.label_exibicao}
      meta={meta}
      metaAjustada={metaAjustada}
      realizado={kpiValue}
      pct={pct}           // Recalculado localmente
      multiplicador={mult} // Recalculado localmente
      valorBase={valorBase}
      valorFinal={valorFinal} // Recalculado localmente
      isPercentage={config.isPercentage}
      isManual={!config.isAuto}
    />
  );
}
```

## Resultado Esperado

Para Julia Caroline com meta compPlan = 171:

| Campo | Antes (Inconsistente) | Depois (Consistente) |
|-------|----------------------|---------------------|
| Meta Realizadas | 120 | 120 |
| Realizado | 69 | 69 |
| Porcentagem | 54.8% (errado) | 57.5% (correto) |
| Multiplicador | 0x | 0x |
| Valor Base | R$ 400 | R$ 400 |
| Valor Final | R$ 0 | R$ 0 |

## Consideracao

Esta correcao faz a INTERFACE exibir valores consistentes. Os valores salvos no payout continuarao usando a logica da Edge Function. Caso deseje que ambos usem a mesma fonte (compPlan), seria necessario tambem atualizar a Edge Function para priorizar `compPlan.meta_reunioes_agendadas`.
