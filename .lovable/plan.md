

# Corrigir Indicadores para Usar Valores do Plano Individual

## Problema Identificado

Os indicadores de meta estao calculando o `valorBase` sempre de forma dinamica (`variavel_total * peso_percentual / 100`), ignorando os valores especificos configurados no plano individual (`valor_meta_rpg`, `valor_docs_reuniao`, `valor_tentativas`, `valor_organizacao`).

### Fluxo Atual (Incorreto)
```text
EditIndividualPlanDialog -> salva valor_meta_rpg = R$ 475,00 -> sdr_comp_plan
                                                                     |
DynamicIndicatorCard -> calcula valorBase = variavel * peso% = R$ 540,00
                        (ignora o valor do plano individual!)
```

### Fluxo Esperado
```text
EditIndividualPlanDialog -> salva valor_meta_rpg = R$ 475,00 -> sdr_comp_plan
                                                                     |
DynamicIndicatorCard -> usa valorBase = R$ 475,00 (do plano individual)
```

## Solucao

Alterar `DynamicIndicatorCard.tsx` para:
1. Verificar se existe valor especifico no `compPlan` para a metrica
2. Se existir e for maior que zero, usar esse valor como `valorBase`
3. Se nao existir ou for zero, usar o calculo dinamico como fallback

## Arquivo a Modificar

**src/components/fechamento/DynamicIndicatorCard.tsx**

### Alteracao (Linhas 139-148)

Codigo atual:
```javascript
if (config.payoutPctField && config.payoutMultField && config.payoutValueField) {
  const pct = (payout as any)[config.payoutPctField] || 0;
  const mult = (payout as any)[config.payoutMultField] || 0;
  const valorFinal = (payout as any)[config.payoutValueField] || 0;
  
  // Calculate valorBase dynamically from peso_percentual
  const baseVariavel = variavelTotal || compPlan?.variavel_total || 1200;
  const pesoPercent = metrica.peso_percentual || 25;
  const valorBase = baseVariavel * (pesoPercent / 100);
```

Codigo corrigido:
```javascript
if (config.payoutPctField && config.payoutMultField && config.payoutValueField) {
  const pct = (payout as any)[config.payoutPctField] || 0;
  const mult = (payout as any)[config.payoutMultField] || 0;
  const valorFinal = (payout as any)[config.payoutValueField] || 0;
  
  // Prioridade: valor especifico do compPlan > calculo dinamico
  let valorBase = 0;
  
  if (config.compPlanValueField && compPlan) {
    const valorEspecifico = (compPlan as any)[config.compPlanValueField] || 0;
    if (valorEspecifico > 0) {
      valorBase = valorEspecifico;
    }
  }
  
  // Fallback: calculo dinamico se nao houver valor especifico
  if (valorBase === 0) {
    const baseVariavel = variavelTotal || compPlan?.variavel_total || 1200;
    const pesoPercent = metrica.peso_percentual || 25;
    valorBase = baseVariavel * (pesoPercent / 100);
  }
```

## Mapeamento de Campos (METRIC_CONFIG)

| Metrica | Campo CompPlan |
|---------|----------------|
| agendamentos | `valor_meta_rpg` |
| realizadas | `valor_docs_reuniao` |
| tentativas | `valor_tentativas` |
| organizacao | `valor_organizacao` |

## Resultado Esperado

- Quando o usuario editar valores no plano individual, os indicadores refletirao os novos valores imediatamente
- Se os valores especificos forem zero (ou nao configurados), o sistema usara o calculo dinamico como fallback
- Compatibilidade total com a arquitetura atual de pesos percentuais

