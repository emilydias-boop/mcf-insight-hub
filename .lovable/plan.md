
# Corrigir Edge Function para Usar Valores do Plano Individual

## Problema Identificado

A edge function `recalculate-sdr-payout` esta calculando os valores finais usando a formula de peso (`variavel_total * peso_percentual / 100`) em vez de usar os valores especificos configurados no plano individual (`valor_meta_rpg`, `valor_docs_reuniao`, `valor_tentativas`, `valor_organizacao`).

### Exemplo do Problema

O usuario configurou no plano:
- `valor_meta_rpg` = R$ 475,00
- `valor_docs_reuniao` = R$ 475,00
- `valor_tentativas` = R$ 200,00
- `valor_organizacao` = R$ 200,00

Mas a edge function esta calculando:
- Agendamentos = R$ 1.200 x 45% = R$ 540,00 (errado)
- Realizadas = R$ 1.200 x 45% = R$ 540,00 x 0.7 = R$ 378,00 (errado)

Quando deveria ser:
- Agendamentos = R$ 475,00 x 1 = R$ 475,00 (correto)
- Realizadas = R$ 475,00 x 0.7 = R$ 332,50 (correto)

## Solucao

Alterar a edge function `recalculate-sdr-payout` para priorizar os valores especificos do compPlan sobre o calculo dinamico por peso.

### Arquivo a Modificar

**supabase/functions/recalculate-sdr-payout/index.ts**

### Alteracao (Linhas 316-355)

Logica atual:
```javascript
if (hasActiveMetrics) {
  const variavelTotal = compPlan.variavel_total || ...;
  
  // Sempre calcula pelo peso (ignora valores do plano)
  valor_reunioes_agendadas = pesoAgendadas > 0 
    ? (variavelTotal * (pesoAgendadas / 100)) * mult_reunioes_agendadas 
    : 0;
  valor_reunioes_realizadas = pesoRealizadas > 0 
    ? (variavelTotal * (pesoRealizadas / 100)) * mult_reunioes_realizadas 
    : 0;
  // ...
}
```

Nova logica (priorizar valores especificos):
```javascript
if (hasActiveMetrics) {
  const variavelTotal = compPlan.variavel_total || ...;
  
  // PRIORIZAR valores especificos do compPlan > calculo dinamico por peso
  valor_reunioes_agendadas = compPlan.valor_meta_rpg > 0
    ? compPlan.valor_meta_rpg * mult_reunioes_agendadas
    : (pesoAgendadas > 0 ? (variavelTotal * (pesoAgendadas / 100)) * mult_reunioes_agendadas : 0);
    
  valor_reunioes_realizadas = compPlan.valor_docs_reuniao > 0
    ? compPlan.valor_docs_reuniao * mult_reunioes_realizadas
    : (pesoRealizadas > 0 ? (variavelTotal * (pesoRealizadas / 100)) * mult_reunioes_realizadas : 0);
    
  valor_tentativas = compPlan.valor_tentativas > 0
    ? compPlan.valor_tentativas * mult_tentativas
    : (pesoTentativas > 0 && !isCloser ? (variavelTotal * (pesoTentativas / 100)) * mult_tentativas : 0);
    
  valor_organizacao = compPlan.valor_organizacao > 0
    ? compPlan.valor_organizacao * mult_organizacao
    : (pesoOrganizacao > 0 && !isCloser ? (variavelTotal * (pesoOrganizacao / 100)) * mult_organizacao : 0);
}
```

## Resumo das Alteracoes

| Campo | Logica Atual | Nova Logica |
|-------|--------------|-------------|
| valor_reunioes_agendadas | variavel x peso% x mult | valor_meta_rpg x mult (se > 0) |
| valor_reunioes_realizadas | variavel x peso% x mult | valor_docs_reuniao x mult (se > 0) |
| valor_tentativas | variavel x peso% x mult | valor_tentativas x mult (se > 0) |
| valor_organizacao | variavel x peso% x mult | valor_organizacao x mult (se > 0) |

## Resultado Esperado

Apos recalcular:
- Agendamentos R1: R$ 475,00 x 1 = R$ 475,00
- R1 Realizadas: R$ 475,00 x 0.7 = R$ 332,50
- Tentativas: R$ 200,00 x 0.5 = R$ 100,00
- Organizacao: R$ 200,00 x 1 = R$ 200,00
