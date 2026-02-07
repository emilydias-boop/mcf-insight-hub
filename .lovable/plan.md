
# Corrigir Valor Base para uma Closer Específica

## Problema

O valor **R$ 1.200,00** mostrado como "Valor Base" no card de indicadores vem do fallback definido no código:

```typescript
// src/pages/fechamento-sdr/Detail.tsx - linha 130
const effectiveVariavelEarly = compPlan?.variavel_total || employeeEarly?.cargo_catalogo?.variavel_valor || 1200;
```

A Closer específica cai no fallback de **1200** porque:
- Não tem `sdr_comp_plan` aprovado OU
- O plano dela tem `variavel_total = 1200`

## Solução

**Duas opções:**

### Opção 1 - Via Interface (Recomendado)
Ir na tela de **Configurações** do fechamento dessa Closer e definir o `variavel_total = 400` no plano de compensação dela.

### Opção 2 - Mudar Fallback no Código
Mudar o fallback de 1200 para 400 no código. **Isso afeta TODOS os funcionários sem plano configurado.**

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/pages/fechamento-sdr/Detail.tsx` | 130 | Fallback de `1200` → `400` |

```typescript
// ANTES
const effectiveVariavelEarly = compPlan?.variavel_total || employeeEarly?.cargo_catalogo?.variavel_valor || 1200;

// DEPOIS
const effectiveVariavelEarly = compPlan?.variavel_total || employeeEarly?.cargo_catalogo?.variavel_valor || 400;
```

## Recomendação

Se **apenas essa Closer** deve ter R$ 400 e os outros devem continuar com R$ 1.200, a solução correta é criar/atualizar o **plano de compensação individual** dela com `variavel_total = 400`.

Se **todos** os funcionários sem plano devem ter R$ 400 como padrão, então podemos mudar o fallback no código.

**Qual opção você prefere?**
