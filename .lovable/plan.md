

# Adicionar métrica R2 Agendadas no cálculo de variável dos Closers

## Problema

A edge function `recalculate-sdr-payout` calcula a variável dos Closers somando apenas 4 métricas:

```
valorVariavelTotal = valorContratos + valorOrganizacao + valorRealizadas + valorVendasParceria
```

A métrica **r2_agendadas** (peso 50%) está completamente ausente do cálculo. Por isso:
- **Thayna**: mostra R$675 (só contratos) em vez de R$675 + R$945 = R$1.620
- **Julio**: mostra R$1.200 (só contratos) em vez de R$1.200 + R$600 = R$1.800

## Correção

Adicionar o bloco de cálculo de `r2_agendadas` na edge function, seguindo o mesmo padrão das outras métricas (buscar peso, calcular meta como % dos contratos pagos, aplicar multiplicador).

## Arquivo

| Arquivo | Alteração |
|---|---|
| `supabase/functions/recalculate-sdr-payout/index.ts` | Adicionar bloco de cálculo para `r2_agendadas` entre vendas_parceria e o total |

## Detalhes técnicos

No arquivo `supabase/functions/recalculate-sdr-payout/index.ts`, após o bloco de vendas_parceria (linha ~1178), adicionar:

```typescript
// Calcular R2 Agendadas
const metricaR2 = metricasAtivas.find(m => m.nome_metrica === 'r2_agendadas');
let valorR2Agendadas = 0;

if (metricaR2 && metricaR2.peso_percentual > 0) {
  const pesoR2 = metricaR2.peso_percentual;
  const valorBaseR2 = (cargoInfo.variavel_valor * pesoR2) / 100;
  
  // Meta = % dos contratos pagos (default 100%)
  const pctR2 = metricaR2.meta_percentual && metricaR2.meta_percentual > 0 
    ? metricaR2.meta_percentual : 100;
  const metaR2 = Math.round((contratosPagos * pctR2) / 100);
  
  // Valor realizado do KPI
  const r2Real = kpi.r2_agendadas || 0;
  const pctR2Atingido = metaR2 > 0 ? (r2Real / metaR2) * 100 : 0;
  const multR2 = getMultiplier(Math.min(pctR2Atingido, 120));
  valorR2Agendadas = valorBaseR2 * multR2;
  
  console.log(`   📊 R2 Agendadas: Real=${r2Real}, Meta=${metaR2}, %=${pctR2Atingido.toFixed(1)}%, Mult=${multR2}, Valor=R$ ${valorR2Agendadas.toFixed(2)}`);
}
```

E atualizar a soma:
```typescript
const valorVariavelTotal = valorContratos + valorOrganizacao + valorRealizadas + valorVendasParceria + valorR2Agendadas;
```

Após o deploy, recalcular os payouts de Março para Julio e Thayna.

