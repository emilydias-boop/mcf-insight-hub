
# Correção: Erro de Sintaxe na Edge Function

## Problema Identificado

A edge function `recalculate-sdr-payout` não está carregando devido a dois erros:

### Erro 1: Declaração duplicada de variáveis
```
Uncaught SyntaxError: Identifier 'year' has already been declared
at file:///var/tmp/sb-compile-edge-runtime/recalculate-sdr-payout/index.ts:416:12
```

O código declara `const [year, month]` duas vezes no mesmo escopo:

| Linha | Código |
|-------|--------|
| 455 | `const [year, month] = ano_mes.split('-').map(Number);` |
| 569 | `const [year, month] = ano_mes.split('-').map(Number);` (DUPLICADO) |

### Erro 2: Interface incompleta
A interface `CompPlan` (linha 31-44) não inclui `variavel_total`, mas o código na linha 317 tenta acessar `compPlan.variavel_total`.

---

## Solução

### 1. Adicionar `variavel_total` à interface `CompPlan`

**Arquivo**: `supabase/functions/recalculate-sdr-payout/index.ts`
**Linhas**: 31-44

```typescript
interface CompPlan {
  meta_reunioes_agendadas: number;
  meta_reunioes_realizadas: number;
  meta_tentativas: number;
  meta_organizacao: number;
  valor_meta_rpg: number;
  valor_docs_reuniao: number;
  valor_tentativas: number;
  valor_organizacao: number;
  fixo_valor: number;
  ifood_mensal: number;
  ifood_ultrameta: number;
  dias_uteis: number;
  variavel_total: number; // ADICIONAR
}
```

### 2. Remover declaração duplicada na linha 569

**Arquivo**: `supabase/functions/recalculate-sdr-payout/index.ts`
**Linha**: 569

Remover a linha duplicada:
```typescript
// REMOVER esta linha:
const [year, month] = ano_mes.split('-').map(Number);
```

As variáveis `year`, `month`, `monthStart` e `monthEnd` já foram declaradas anteriormente na linha 455-460, então podem ser reutilizadas na linha 569-572.

### 3. Reimplantar a Edge Function

Após as correções, reimplantar a função para que as mudanças entrem em vigor.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/recalculate-sdr-payout/index.ts` | Adicionar `variavel_total` na interface CompPlan (linha 43) |
| `supabase/functions/recalculate-sdr-payout/index.ts` | Remover declaração duplicada de `[year, month]` (linha 569-572) |

---

## Resultado Esperado

Após a correção:
1. A edge function carregará sem erros de sintaxe
2. O cálculo usará corretamente o `variavel_total` do plano de compensação
3. O fechamento da Carol Correa exibirá os valores corretos (Variável R$ 1.350)
