

# Corrigir meta de contratos da Thayna (N2 = 35%, não 30%)

## Diagnóstico

Dois problemas combinados causam o erro:

### Problema 1: Métricas não configuradas para abril 2026
A tabela `fechamento_metricas_mes` tem configurações para o cargo "Closer Inside N2" apenas até março. Para abril (2026-04), não existe nenhuma linha. O hook `useActiveMetricsForSdr` retorna métricas padrão (fallback), que não incluem `meta_percentual`.

### Problema 2: Fallback hardcoded em 30%
Quando `meta_percentual` é null, o `KpiEditForm` usa `(isCloser ? 30 : undefined)` — sempre 30%, ignorando o nível do closer.

```text
Fluxo atual:
  Mês sem config → fallback defaults (sem meta_percentual) → KpiEditForm hardcode 30%

Fluxo correto:
  Mês sem config → busca config do mês anterior → meta_percentual = 35% (N2)
  OU
  Fallback → busca nivel do cargo → N2 = 35%
```

## Solução

### Arquivo 1: `src/hooks/useActiveMetricsForSdr.ts`
- Quando não encontrar métricas para o `ano_mes` solicitado, buscar do mês mais recente disponível para o mesmo `cargo_catalogo_id`
- Isso garante que ao criar um novo mês de fechamento, as configurações de métricas (incluindo `meta_percentual`) sejam herdadas

### Arquivo 2: `src/components/sdr-fechamento/KpiEditForm.tsx`
- Substituir o fallback hardcoded `(isCloser ? 30 : undefined)` por uma lógica baseada no nível do cargo:
  - N1 = 30%, N2 = 35%, N3 = 40%
- Buscar o nível do `cargos_catalogo` via `cargo_catalogo_id` do comp plan

### Arquivo 3: `supabase/functions/recalculate-sdr-payout/index.ts`
- Mesma correção no fallback do servidor: quando `meta_percentual` é null, usar o nível do cargo para determinar a porcentagem correta em vez de hardcodar 30%

## Resultado esperado
- Thayna (Closer Inside N2) aparece com "Meta: 35% de X Realizadas" em todos os meses
- Novos meses de fechamento herdam as configurações de métricas do mês anterior
- O recálculo no servidor também usa 35% para N2

