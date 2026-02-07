
# Corrigir Prioridade do Cálculo de Valor Base

## Problema

O valor "R$ 1.200,00" está sendo exibido porque o código atual **prioriza** o campo `valor_meta_rpg` salvo no plano de compensação.

### Código Atual (linha 168-183)
```typescript
// Prioridade: valor específico do compPlan > cálculo dinâmico ❌
let valorBase = 0;

if (config.compPlanValueField && compPlan) {
  const valorEspecifico = (compPlan as any)[config.compPlanValueField] || 0;
  if (valorEspecifico > 0) {
    valorBase = valorEspecifico;  // Usa R$ 1.200 do banco
  }
}

// Fallback: cálculo dinâmico
if (valorBase === 0) {
  valorBase = baseVariavel * (pesoPercent / 100);
}
```

## Solução

Inverter a prioridade conforme a lógica de negócio documentada:

### Código Novo
```typescript
// CORRIGIDO: Prioridade para cálculo dinâmico (peso-based)
const baseVariavel = variavelTotal || compPlan?.variavel_total || 400;
const pesoPercent = metrica.peso_percentual || 0;

let valorBase = 0;

// Prioridade 1: Cálculo dinâmico se peso está definido
if (pesoPercent > 0) {
  valorBase = baseVariavel * (pesoPercent / 100);
}

// Fallback: valor específico do compPlan se não houver peso
if (valorBase === 0 && config.compPlanValueField && compPlan) {
  valorBase = (compPlan as any)[config.compPlanValueField] || 0;
}

// Fallback final
if (valorBase === 0) {
  valorBase = baseVariavel * 0.25; // 25% default
}
```

## Resultado Esperado

| Situação | Antes | Depois |
|----------|-------|--------|
| Com peso 25% e variavelTotal=400 | R$ 1.200 (do banco) | R$ 100 (400 × 25%) |
| Com peso 100% e variavelTotal=400 | R$ 1.200 (do banco) | R$ 400 (400 × 100%) |
| Sem peso definido | R$ 1.200 (do banco) | R$ 1.200 (fallback do banco) |

## Arquivos a Alterar

| Arquivo | Mudança |
|---------|---------|
| `src/components/fechamento/DynamicIndicatorCard.tsx` | Inverter prioridade: dinâmico primeiro, compPlan como fallback |
| `src/hooks/useCalculatedVariavel.ts` | Mesma lógica para consistência |

## Nota

Se o peso_percentual da métrica "agendamentos" estiver configurado como 100%, o valor exibido será R$ 400,00 (400 × 100%). Se estiver como 25%, será R$ 100,00 (400 × 25%).

Caso queira exatamente R$ 400,00, verifique se o peso_percentual da métrica está configurado corretamente na tabela `fechamento_metricas_mes`.
