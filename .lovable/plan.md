
# Corrigir Erro de Hooks - "Rendered more hooks than during the previous render"

## Problema Identificado

O erro ocorre porque o hook `useCalculatedVariavel` é chamado **DEPOIS** dos early returns no componente `FechamentoSDRDetail`. Isso viola as regras de hooks do React.

### Fluxo Atual (com problema):

```text
FechamentoSDRDetail
│
├── useParams, useNavigate, useSearchParams
├── useAuth
├── useSdrPayoutDetail, useSdrCompPlan, useSdrMonthKpi, useSdrIntermediacoes
├── useCloserAgendaMetrics
├── useActiveMetricsForSdr
├── useUpdatePayoutStatus, useRecalculateWithKpi, useAuthorizeUltrameta
│
├── if (isLoading) return <Loading />    ← EARLY RETURN #1
├── if (!payout) return <NotFound />     ← EARLY RETURN #2
│
└── useCalculatedVariavel()              ← HOOK CHAMADO DEPOIS DOS RETURNS!
```

### O que acontece:

1. **Primeira renderização**: `isLoading = true`, componente retorna na linha 132-138 com X hooks chamados
2. **Segunda renderização**: dados carregam, componente passa pelos early returns e chama `useCalculatedVariavel`
3. **Erro**: React detecta que foram chamados MAIS hooks nesta renderização do que na anterior

## Solucao

Mover a chamada do `useCalculatedVariavel` para ANTES dos early returns. O hook já trata dados nulos/vazios internamente retornando `{ total: 0, indicators: [] }`.

## Arquivo a Alterar

`src/pages/fechamento-sdr/Detail.tsx`

### Mudancas Necessarias

1. **Mover chamada do useCalculatedVariavel para antes dos early returns** (aproximadamente linha 125)

2. **Ajustar as variaveis que o hook precisa** para estarem disponíveis antes dos early returns:
   - `activeMetrics` - já está disponível (linha 118)
   - `effectiveKpi` - precisa ser calculado antes
   - `payout` - já existe mas pode ser null
   - `compPlan` - já existe mas pode ser null
   - `diasUteisMes` - usar valor padrão se payout for null
   - `sdrMetaDiaria` - usar valor padrão se payout for null
   - `effectiveVariavel` - precisa ser calculado antes

3. **O hook já lida com valores null** (linha 42-44 do hook):
   ```typescript
   if (!metricas || metricas.length === 0 || !payout) {
     return { total: 0, indicators: [] };
   }
   ```

## Codigo Proposto

### Antes (problema - linhas 126-303):

```typescript
const isAdmin = role === "admin";
// ... mais código ...

if (isLoading) {
  return (...);    // EARLY RETURN
}

if (!payout) {
  return (...);    // EARLY RETURN
}

// ... mais código ...

const effectiveKpi = kpi ? ... : null;

const calculatedVariavel = useCalculatedVariavel({...}); // HOOK DEPOIS DO RETURN!
```

### Depois (corrigido):

```typescript
const isAdmin = role === "admin";
// ... código existente até linha 131 ...

// MOVER: Calcular valores efetivos ANTES dos early returns
const isCloserEarly = (payout?.sdr as any)?.role_type === "closer";
const sdrMetaDiariaEarly = (payout?.sdr as any)?.meta_diaria || 10;
const diasUteisMesEarly = payout?.dias_uteis_mes || 19;
const employeeEarly = (payout as any)?.employee;
const effectiveVariavelEarly = compPlan?.variavel_total || employeeEarly?.cargo_catalogo?.variavel_valor || 1200;

const effectiveKpiEarly: SdrMonthKpi | null = kpi 
  ? isCloserEarly && closerMetrics.data
    ? { ...kpi, reunioes_realizadas: closerMetrics.data.r1_realizadas, ... }
    : kpi
  : null;

// MOVER: Chamar hook ANTES dos early returns
const calculatedVariavel = useCalculatedVariavel({
  metricas: activeMetrics,
  kpi: effectiveKpiEarly,
  payout,
  compPlan,
  diasUteisMes: diasUteisMesEarly,
  sdrMetaDiaria: sdrMetaDiariaEarly,
  variavelTotal: effectiveVariavelEarly,
});

if (isLoading) {
  return (...);
}

if (!payout) {
  return (...);
}

// ... resto do componente usando as variaveis calculadas ...
```

## Resultado Esperado

- O hook `useCalculatedVariavel` sera chamado em TODAS as renderizacoes, independente do estado de loading
- O hook retorna `{ total: 0, indicators: [] }` quando não há dados
- Erro "Rendered more hooks than during the previous render" será corrigido
- A página de detalhes do SDR voltará a funcionar normalmente

## Impacto

- Nenhuma mudança na lógica de negócio
- Nenhuma mudança no layout ou valores exibidos
- Apenas reorganização da ordem das chamadas de hooks para seguir as regras do React
