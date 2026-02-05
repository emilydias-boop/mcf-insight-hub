
# Correção: Cálculo Incorreto do Variável na Edge Function

## Problema Identificado

A edge function `recalculate-sdr-payout` está calculando o valor variável de forma incorreta:

```typescript
// LINHA 317-318 (INCORRETO)
const variavelTotal = compPlan.valor_meta_rpg + compPlan.valor_docs_reuniao + 
                      compPlan.valor_tentativas + compPlan.valor_organizacao;
// Resultado: 300 + 300 + 300 + 300 = R$ 1.200 ❌
```

Deveria usar:
```typescript
// CORRETO
const variavelTotal = compPlan.variavel_total;
// Resultado: R$ 1.350 ✓
```

### Dados da Carol Correa

| Campo | Valor Atual | Esperado |
|-------|------------|----------|
| `variavel_total` | R$ 1.350 | ✓ Correto |
| Soma dos valores individuais | R$ 1.200 | ❌ Desatualizado |

### Impacto nos Indicadores

Os cards estão mostrando inconsistências matemáticas:

| Indicador | Valor Base (exibido) | Valor Final (salvo) | Problema |
|-----------|---------------------|---------------------|----------|
| Agendamentos | R$ 475,07 × 1 = | R$ 422,28 | ❌ Não bate |
| Realizadas | R$ 475,07 × 0.7 = | R$ 295,60 | ❌ Não bate |
| Tentativas | R$ 199,94 × 0.5 = | R$ 88,86 | ❌ Não bate |
| Organização | R$ 199,94 × 1 = | R$ 177,72 | ❌ Não bate |

---

## Solução

### 1. Corrigir Edge Function (principal)

Modificar `recalculate-sdr-payout/index.ts` para usar `variavel_total` diretamente:

**Linha 317-318 - ANTES:**
```typescript
const variavelTotal = compPlan.valor_meta_rpg + compPlan.valor_docs_reuniao + 
                      compPlan.valor_tentativas + compPlan.valor_organizacao;
```

**DEPOIS:**
```typescript
// Usar variavel_total do compPlan, com fallback para soma dos valores individuais
const variavelTotal = compPlan.variavel_total || 
  (compPlan.valor_meta_rpg + compPlan.valor_docs_reuniao + 
   compPlan.valor_tentativas + compPlan.valor_organizacao);
```

### 2. Recalcular o Payout

Após a correção, o usuário precisará:
1. Clicar em **"Salvar e Recalcular"** na página de fechamento
2. Os valores serão recalculados com o variável correto (R$ 1.350)

---

## Valores Esperados Após Correção

Com variável = R$ 1.350 e os pesos configurados (35.19% / 35.19% / 14.81% / 14.81%):

| Indicador | Valor Base | Mult | Valor Final |
|-----------|-----------|------|-------------|
| Agendamentos | R$ 475,07 | 1.0x | **R$ 475,07** |
| Realizadas | R$ 475,07 | 0.7x | **R$ 332,55** |
| Tentativas | R$ 199,94 | 0.5x | **R$ 99,97** |
| Organização | R$ 199,94 | 1.0x | **R$ 199,94** |
| **TOTAL** | | | **R$ 1.107,53** |

Variável Total atual: R$ 984,46 → Esperado: **R$ 1.107,53**

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/recalculate-sdr-payout/index.ts` | Usar `compPlan.variavel_total` ao invés da soma dos valores individuais |

---

## Resumo Técnico

O bug ocorre porque:
1. O sistema permite atualizar `variavel_total` independentemente dos valores individuais
2. A edge function soma os valores individuais ao invés de usar o `variavel_total`
3. Isso causa discrepância quando o plano é atualizado parcialmente

A correção garante que sempre use o `variavel_total` como fonte da verdade para os cálculos.
