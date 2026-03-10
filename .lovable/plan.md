

## Corrigir discrepância de valores: Calcular variável localmente na tabela

### Problema
A tabela do Index mostra `payout.valor_variavel_total` do banco (último cálculo salvo), enquanto a página de Detalhe recalcula em tempo real com `useCalculatedVariavel`. Resultado: valores diferentes (ex: Juliana R$743 na tabela vs R$953 no detalhe).

O warning icon adicionado anteriormente não resolve o problema - o usuário precisa ver o valor correto direto na tabela.

### Solução

Criar um componente `PayoutTableRow` que encapsula cada linha da tabela e internamente usa os mesmos hooks do Detail para calcular o variável real. Também recalcular os totalizadores com os valores locais.

### Mudanças

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | Criar `src/components/fechamento/PayoutTableRow.tsx` | Componente que renderiza uma `<TableRow>` e internamente chama `useActiveMetricsForSdr`, `useSdrMonthKpi`, `useSdrCompPlan`, e `useCalculatedVariavel` para exibir o valor calculado real |
| 2 | `src/pages/fechamento-sdr/Index.tsx` | Substituir o render inline de cada payout por `<PayoutTableRow>`, passar callback `onCalculated` para reportar o valor ao pai para os totalizadores |

### Detalhes técnicos

**PayoutTableRow** receberá:
- `payout` (dados do banco)
- `compPlan` (já carregado pelo pai)
- `anoMes` (mês selecionado)
- `onCalculated(payoutId, variavel, totalConta)` - callback para atualizar totalizadores no pai

Internamente:
1. `useActiveMetricsForSdr(payout.sdr_id, anoMes)` → métricas
2. `useSdrMonthKpi(payout.sdr_id, anoMes)` → KPI atualizado
3. `useCalculatedVariavel(...)` → valor real
4. `useEffect` → reporta valor calculado ao pai via callback

**Index.tsx**:
- Estado `calculatedValues: Record<string, { variavel: number; totalConta: number }>` 
- Cards de total somam valores calculados quando disponíveis, fallback para banco
- Exibe badge sutil quando valor calculado diverge do banco

### Performance
~48 queries extras para 16 SDRs, mas React Query faz cache/dedup (métricas por squad são compartilhadas, `staleTime: 30s`). Na prática serão ~3-4 queries únicas de métricas + 16 de KPI.

